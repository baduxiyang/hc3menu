import { defineStore } from "pinia"
import { Hc3ApiClient, Hc3ApiError } from "../api/hc3"
import type {
  Hc3Credentials,
  Hc3DebugMessage,
  Hc3Device,
  Hc3Partition,
  Hc3Room,
  NormalizedChange,
} from "../types/hc3"
import { useSettingsStore } from "./settings"
import type { NotificationRule } from "../types/settings"

type ActivityItem = {
  ts: number
  kind: string
  dev_id?: number
  dev_name?: string
  text: string
}

function matches(rule: NotificationRule, change: NormalizedChange): boolean {
  if (Number(rule.device_id) !== Number(change.id ?? -1)) return false
  const prop = String(change.property || change.name || "")
  if (rule.property && rule.property !== prop) return false
  const cond = String(rule.condition || "any").trim()
  const nv = change.newValue
  if (cond === "any") return true
  if (cond === "true") return Boolean(nv) === true
  if (cond === "false") return Boolean(nv) === false
  try {
    if (cond.startsWith(">")) return Number(nv) > Number(cond.slice(1))
    if (cond.startsWith("<")) return Number(nv) < Number(cond.slice(1))
    if (cond.startsWith("==")) return String(nv) === cond.slice(2)
  } catch {}
  return false
}

function formatRule(rule: NotificationRule, change: NormalizedChange, dev?: Hc3Device, roomName?: string) {
  const prop = String(change.property || change.name || "")
  const ctx = {
    name: dev?.name || `Device ${change.id}`,
    id: change.id,
    property: prop,
    newValue: change.newValue,
    oldValue: change.oldValue,
    room: roomName || "",
  }
  let body = `${ctx.name} ${ctx.property} -> ${ctx.newValue}`
  try {
    const tpl = String(rule.message || "{name} {property} -> {newValue}")
    body = tpl.replace(/\{(\w+)\}/g, (_, k) => String((ctx as any)[k] ?? ""))
  } catch {}
  const title = String(ctx.name)
  return { title, body }
}

function pushRing<T>(arr: T[], item: T, max: number) {
  arr.unshift(item)
  if (arr.length > max) arr.splice(max)
}

export const useHc3Store = defineStore("hc3", {
  state: () => ({
    connected: false,
    lastError: "",
    lastRefresh: 0,
    devices: {} as Record<number, Hc3Device>,
    rooms: {} as Record<number, Hc3Room>,
    partitions: {} as Record<number, Hc3Partition>,
    profiles: [] as Array<Record<string, any>>,
    activeProfileId: null as number | null,
    scenes: [] as Array<Record<string, any>>,
    favoriteColors: [] as Array<Record<string, any>>,
    diagnostics: {} as Record<string, any>,
    cpuPcts: [] as number[],
    debugMessages: [] as Hc3DebugMessage[],
    activity: [] as ActivityItem[],
    _debugSeenIds: {} as Record<number, true>,
    _pollRunning: false,
    _diagRunning: false,
    _pollToken: 0,
    _diagToken: 0,
    _consecutiveErrors: 0,
    _deadNotified: {} as Record<number, true>,
    _lowBattNotified: {} as Record<number, true>,
    _qaErrorLastNotify: {} as Record<string, number>,
    api: null as Hc3ApiClient | null,
  }),
  getters: {
    deviceList(state): Hc3Device[] {
      return Object.values(state.devices)
    },
    roomName(state) {
      return (roomId?: number) => {
        const r = state.rooms[Number(roomId || 0)]
        return r?.name || "Unassigned"
      }
    },
  },
  actions: {
    async connect(creds: Hc3Credentials) {
      this.api = this.api ? (this.api.setCredentials(creds), this.api) : new Hc3ApiClient(creds)
      const test = await this.api.testConnection()
      if (!test.ok) {
        this.connected = false
        this.lastError = test.message
        uni.showToast({ title: "连接失败", icon: "none" })
        return
      }
      await this.refreshNow()
      this.resume()
    },

    pause() {
      this._pollToken += 1
      this._diagToken += 1
      this._pollRunning = false
      this._diagRunning = false
    },

    resume() {
      if (!this.api) return
      if (!this._pollRunning) this.startPollLoop()
      if (!this._diagRunning) this.startDiagLoop()
    },

    async refreshNow() {
      if (!this.api) return
      try {
        const [devices, rooms, parts, profilesResp, scenes, favColors] = await Promise.all([
          this.api.getDevices(),
          this.api.getRooms(),
          this.api.getPartitions().catch(() => [] as Hc3Partition[]),
          this.api.getProfiles().catch(() => ({ activeProfile: null, profiles: [] })),
          this.api.getScenes().catch(() => [] as any[]),
          this.api.getFavoriteColors().catch(() => [] as any[]),
        ])
        this.devices = Object.fromEntries(devices.map((d) => [Number(d.id), d]))
        this.rooms = Object.fromEntries(rooms.map((r) => [Number(r.id), r]))
        this.partitions = Object.fromEntries(parts.map((p) => [Number(p.id), p]))
        this.profiles = profilesResp.profiles || []
        this.activeProfileId = profilesResp.activeProfile ?? null
        this.scenes = scenes || []
        this.favoriteColors = favColors || []
        this.seedAttentionState()
        this.connected = true
        this.lastError = ""
      } catch (e: any) {
        this.connected = false
        this.lastError = e?.message || String(e)
      }
    },

    seedAttentionState() {
      const settings = useSettingsStore()
      this._deadNotified = {}
      this._lowBattNotified = {}
      const th = Number(settings.low_battery_threshold || 20)
      for (const d of Object.values(this.devices)) {
        const props = d.properties || {}
        if (Boolean(props.dead)) this._deadNotified[Number(d.id)] = true
        const batt = props.batteryLevel
        const v = Number(batt)
        if (Number.isFinite(v) && v <= th) this._lowBattNotified[Number(d.id)] = true
      }
    },

    normalizeEvent(event: Record<string, any>): NormalizedChange[] {
      const etype = event?.type
      const edata = event?.data || {}
      if (etype === "DevicePropertyUpdatedEvent") {
        return [
          {
            id: edata.id,
            property: edata.property,
            newValue: edata.newValue,
            oldValue: edata.oldValue,
            _event_type: etype,
          },
        ]
      }
      return [{ _event_type: etype, ...(edata || {}) }]
    },

    handleEvent(change: NormalizedChange): boolean {
      const settings = useSettingsStore()
      const etype = String(change._event_type || "")
      if (!etype) return false

      if (etype.startsWith("AlarmPartition")) {
        const pid = Number((change as any).partitionId ?? (change as any).id ?? -1)
        if (pid >= 0) {
          const p = this.partitions[pid] || { id: pid }
          if ("armed" in change) p.armed = Boolean((change as any).armed)
          if ("breached" in change) p.breached = Boolean((change as any).breached)
          this.partitions[pid] = p
          if ("breached" in change && Boolean((change as any).breached)) {
            this.addActivity({ kind: "breach", text: `Partition ${pid} BREACHED` })
            uni.showToast({ title: `报警触发：Partition ${pid}`, icon: "none" })
          }
        }
        return true
      }

      if (etype === "PluginProcessCrashedEvent") {
        const qaId = (change as any).id ?? ""
        this.addActivity({ kind: "crash", text: `Plugin crashed: ${qaId}` })
        if (settings.qa_crash_notifications) {
          uni.showToast({ title: `QA崩溃：${qaId}`, icon: "none" })
        }
        return true
      }

      return false
    },

    applyChange(change: NormalizedChange) {
      const devId = change.id
      const prop = change.property || change.name
      if (devId == null || !prop) return
      const dev = this.devices[Number(devId)]
      if (!dev) return
      dev.properties = dev.properties || {}
      dev.properties[String(prop)] = change.newValue
    },

    handleActivity(change: NormalizedChange) {
      const devId = Number(change.id ?? -1)
      const prop = String(change.property || change.name || "")
      if (devId < 0 || !prop) return
      const dev = this.devices[devId]
      const name = dev?.name || `Device ${devId}`

      const relevant = new Set([
        "value",
        "state",
        "color",
        "colorComponents",
        "heatingThermostatSetpoint",
        "coolingThermostatSetpoint",
        "targetLevel",
        "dead",
        "batteryLevel",
      ])
      if (!relevant.has(prop)) return

      const text = `${name} ${prop} -> ${String(change.newValue)}`
      this.addActivity({ kind: "device", dev_id: devId, dev_name: name, text })
    },

    addActivity(item: Omit<ActivityItem, "ts">) {
      pushRing(this.activity, { ts: Date.now(), ...item }, 50)
    },
    clearActivity() {
      this.activity = []
    },
    clearDebugMessages() {
      this.debugMessages = []
      this._debugSeenIds = {}
    },

    handleNotifications(change: NormalizedChange) {
      const settings = useSettingsStore()
      const devId = Number(change.id ?? -1)
      const dev = this.devices[devId]
      const roomName = this.roomName(dev?.roomID)

      for (const rule of settings.notifications || []) {
        if (!rule.device_id) continue
        if (matches(rule, change)) {
          const { body } = formatRule(rule, change, dev, roomName)
          uni.showToast({ title: body, icon: "none" })
          break
        }
      }

      if (!settings.attention_notifications) return
      const prop = String(change.property || change.name || "")
      if (prop === "dead") {
        const isDead = Boolean(change.newValue)
        if (isDead && !this._deadNotified[devId]) {
          this._deadNotified[devId] = true
          uni.showToast({ title: `设备离线：${dev?.name || devId}`, icon: "none" })
        }
        if (!isDead && this._deadNotified[devId]) {
          delete this._deadNotified[devId]
          uni.showToast({ title: `设备恢复：${dev?.name || devId}`, icon: "none" })
        }
      }
      if (prop === "batteryLevel") {
        const th = Number(settings.low_battery_threshold || 20)
        const lvl = Number(change.newValue)
        if (Number.isFinite(lvl) && lvl <= th && !this._lowBattNotified[devId]) {
          this._lowBattNotified[devId] = true
          uni.showToast({ title: `低电量：${dev?.name || devId} (${Math.round(lvl)}%)`, icon: "none" })
        }
        if (Number.isFinite(lvl) && lvl > th && this._lowBattNotified[devId]) {
          delete this._lowBattNotified[devId]
        }
      }
    },

    async startPollLoop() {
      if (!this.api) return
      this._pollRunning = true
      const settings = useSettingsStore()
      const token = (this._pollToken += 1)

      while (this._pollRunning && token === this._pollToken) {
        try {
          const data = await this.api.refreshStates(this.lastRefresh, settings.poll_timeout_sec || 35)
          this.lastRefresh = Number(data.last || this.lastRefresh)

          if (this._consecutiveErrors > 0 || !this.connected) {
            this._consecutiveErrors = 0
            if (!this.connected) {
              this.connected = true
              this.lastError = ""
              await this.refreshNow()
              this.addActivity({ kind: "alarm", text: "HC3 reconnected" })
            }
          }

          const allChanges: NormalizedChange[] = []
          for (const c of data.changes || []) allChanges.push(c as any)
          for (const ev of data.events || []) allChanges.push(...this.normalizeEvent(ev))

          for (const ch of allChanges) {
            if (this.handleEvent(ch)) continue
            this.applyChange(ch)
            this.handleActivity(ch)
            this.handleNotifications(ch)
          }
        } catch (e: any) {
          this._consecutiveErrors += 1
          const msg = e?.message || String(e)
          if (this._consecutiveErrors >= 2) {
            if (this.connected) this.addActivity({ kind: "breach", text: "HC3 disconnected" })
            this.connected = false
            this.lastError = msg
          }
          const backoff = Math.min(5 * Math.pow(2, this._consecutiveErrors - 1), 60)
          await new Promise((r) => setTimeout(r, backoff * 1000))
        }
      }
    },

    async startDiagLoop() {
      if (!this.api) return
      this._diagRunning = true
      const token = (this._diagToken += 1)
      const settings = useSettingsStore()

      const tick = async () => {
        if (!this._diagRunning || token !== this._diagToken || !this.api) return
        try {
          const [diag, dbg] = await Promise.all([this.api.getDiagnostics().catch(() => null), this.api.getDebugMessages(100).catch(() => null)])
          if (diag) this.diagnostics = diag

          if (dbg?.messages) {
            const msgs = dbg.messages
            const alreadyInitialized = this.debugMessages.length > 0
            let added = 0
            const sorted = [...msgs].sort((a, b) => Number(b.id) - Number(a.id))
            for (const m of sorted) {
              const id = Number(m.id || 0)
              if (!id || this._debugSeenIds[id]) continue
              this._debugSeenIds[id] = true
              pushRing(this.debugMessages, m, 2000)
              added += 1
            }

            if (added && alreadyInitialized && settings.qa_error_notifications) {
              const newErrors = this.debugMessages.slice(0, added).filter((m) => m.type === "error").slice(0, 3)
              for (const m of newErrors) this.notifyQaError(m)
            }
          }
        } catch (e) {}
        setTimeout(tick, 10_000)
      }

      setTimeout(tick, 0)
    },

    notifyQaError(msg: Hc3DebugMessage) {
      const settings = useSettingsStore()
      const tag = String(msg.tag || "QA")
      const now = Date.now()
      const last = this._qaErrorLastNotify[tag] || 0
      if (now - last < Math.max(1, settings.qa_error_throttle_sec || 60) * 1000) return
      this._qaErrorLastNotify[tag] = now
      let text = String(msg.message || "").trim().replace(/\n/g, " ")
      if (text.length > 200) text = text.slice(0, 197) + "…"
      uni.showToast({ title: `HC3错误(${tag})：${text || "(no message)"}`, icon: "none" })
    },

    async deviceAction(deviceId: number, action: string, args?: any[]) {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.callAction(deviceId, action, args)
    },

    async runScene(sceneId: number) {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.runScene(sceneId)
      this.addActivity({ kind: "scene", text: `Scene ${sceneId} executed` })
    },

    async setActiveProfile(profileId: number) {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.setActiveProfile(profileId)
      this.activeProfileId = profileId
      this.addActivity({ kind: "profile", text: `Profile ${profileId} activated` })
    },

    async armPartition(partitionId: number) {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.armPartition(partitionId)
      this.addActivity({ kind: "alarm", text: `Partition ${partitionId} armed` })
    },

    async disarmPartition(partitionId: number) {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.disarmPartition(partitionId)
      this.addActivity({ kind: "alarm", text: `Partition ${partitionId} disarmed` })
    },

    async armAll() {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.armAllPartitions()
      this.addActivity({ kind: "alarm", text: "Arm all partitions" })
    },

    async disarmAll() {
      if (!this.api) throw new Hc3ApiError("Not connected")
      await this.api.disarmAllPartitions()
      this.addActivity({ kind: "alarm", text: "Disarm all partitions" })
    },
  },
})
