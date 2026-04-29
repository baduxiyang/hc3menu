import { defineStore } from "pinia";
import { HC3Client } from "@/api/hc3";
import { useSettingsStore } from "@/stores/settings";

type ActivityItem = {
  ts: number;
  kind: string;
  devId?: number;
  devName?: string;
  text: string;
};

const nowSec = () => Math.floor(Date.now() / 1000);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const unpackEvent = (evt: any): { type: string; data: any } => {
  if (!evt || typeof evt !== "object") return { type: "", data: null };
  const type = String((evt as any).type || "");
  const data = (evt as any).data && typeof (evt as any).data === "object" ? (evt as any).data : evt;
  return { type, data };
};

const normalizeChange = (evt: any): { id: number; property: string; newValue: any; oldValue: any } | null => {
  if (!evt || typeof evt !== "object") return null;

  const { type, data } = unpackEvent(evt);

  if (type === "DevicePropertyUpdatedEvent") {
    const id = Number(data?.id);
    const property = String(data?.property || "");
    if (!Number.isFinite(id) || !property) return null;
    return { id, property, newValue: data?.newValue, oldValue: data?.oldValue };
  }

  if (data && typeof data === "object" && ("id" in data) && ("property" in data || "name" in data)) {
    const id = Number((data as any).id);
    const property = String((data as any).property || (data as any).name || "");
    if (!Number.isFinite(id) || !property) return null;
    const newValue = (data as any).newValue ?? (data as any).value;
    const oldValue = (data as any).oldValue;
    return { id, property, newValue, oldValue };
  }

  return null;
};

export const useHc3Store = defineStore("hc3", {
  state: () => ({
    client: null as HC3Client | null,

    devices: {} as Record<number, any>,
    rooms: {} as Record<number, any>,
    sections: {} as Record<number, any>,
    partitions: {} as Record<number, any>,
    profiles: [] as any[],
    activeProfileId: null as number | null,
    scenes: [] as any[],
    favoriteColors: [] as any[],

    lastRefresh: 0,
    diagnostics: {} as Record<string, any>,
    cpuPcts: [] as number[],
    prevCpu: [] as any[],

    activity: [] as ActivityItem[],
    debugMsgs: [] as any[],
    debugSeenIds: {} as Record<number, true>,
    debugNextLast: 0,
    attentionNotified: {} as Record<string, true>,
    qaLastNotifiedSec: {} as Record<string, number>,
    qaCrashNotified: {} as Record<number, true>,
    lastStructureRefreshSec: 0,
    lastProfilesRefreshSec: 0,

    connected: false,
    lastError: "",

    syncing: false,
    pollStop: false,
    pollBackoffSec: 2,
    diagTimer: null as number | null,
  }),
  getters: {
    allDevices: (s): any[] => Object.values(s.devices || {}),
    allRooms: (s): any[] => Object.values(s.rooms || {}),
    allSections: (s): any[] => Object.values(s.sections || {}),
    allPartitions: (s): any[] => Object.values(s.partitions || {}),
    recentActivity: (s) => (limit: number = 30) => (s.activity || []).slice(0, limit),
    recentDebugMessages: (s) => (limit: number = 100) => (s.debugMsgs || []).slice(0, limit),
    roomName: (s) => (roomId: number): string => {
      const r = s.rooms?.[Number(roomId)];
      return r?.name || "Unassigned";
    },
  },
  actions: {
    notify(text: string) {
      const g: any = globalThis as any;
      const t = String(text || "");
      if (g.plus?.push?.createMessage) {
        try {
          g.plus.push.createMessage(t, "HC3 Menu");
          return;
        } catch {
        }
      }
      uni.showToast({ title: t.slice(0, 20), icon: "none", duration: 3000 });
    },

    ensureClient() {
      const settings = useSettingsStore();
      if (!this.client) this.client = new HC3Client(settings.creds);
      else this.client.setCredentials(settings.creds);
      return this.client;
    },

    addActivity(item: Omit<ActivityItem, "ts"> & { ts?: number }) {
      const next: ActivityItem = { ts: item.ts ?? Date.now(), kind: item.kind, devId: item.devId, devName: item.devName, text: item.text };
      const list = [next, ...(this.activity || [])];
      this.activity = list.slice(0, 50);
    },

    setConnected(ok: boolean, error?: string) {
      const changed = this.connected !== ok;
      this.connected = ok;
      this.lastError = ok ? "" : (error || this.lastError);
      if (changed) {
        this.addActivity({ kind: "connection", text: ok ? "Connected" : `Disconnected: ${this.lastError || "unknown error"}` });
      }
    },

    mergeDebugMessages(msgs: any[]) {
      const seen = { ...(this.debugSeenIds || {}) };
      const current = this.debugMsgs || [];
      const toAdd: any[] = [];

      const sorted = (msgs || []).slice().sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
      for (const m of sorted) {
        const id = Number(m?.id || 0);
        if (!Number.isFinite(id) || id <= 0) continue;
        if (seen[id]) continue;
        seen[id] = true;
        toAdd.push(m);
      }

      const merged = [...toAdd, ...current].slice(0, 2000);
      const kept: Record<number, true> = {};
      for (const m of merged) {
        const id = Number(m?.id || 0);
        if (Number.isFinite(id) && id > 0) kept[id] = true;
      }

      this.debugMsgs = merged;
      this.debugSeenIds = kept;
      return toAdd;
    },

    updateDiagnostics(diag: any) {
      this.diagnostics = (diag && typeof diag === "object") ? diag : {};
      const cur = Array.isArray(this.diagnostics.cpuLoad) ? this.diagnostics.cpuLoad : [];
      const prevByName: Record<string, any> = {};
      for (const p of this.prevCpu || []) {
        const name = p?.name;
        if (typeof name === "string") prevByName[name] = p;
      }
      const pcts: number[] = [];
      for (const c of cur) {
        const p = prevByName[c?.name];
        if (!p) continue;
        const du = Number(c?.user ?? 0) - Number(p?.user ?? 0);
        const dn = Number(c?.nice ?? 0) - Number(p?.nice ?? 0);
        const ds = Number(c?.system ?? 0) - Number(p?.system ?? 0);
        const di = Number(c?.idle ?? 0) - Number(p?.idle ?? 0);
        const total = du + dn + ds + di;
        if (!Number.isFinite(total) || total <= 0) continue;
        pcts.push((100 * (du + dn + ds)) / total);
      }
      if (pcts.length) this.cpuPcts = pcts;
      this.prevCpu = cur;
    },

    applyChange(change: { id: number; property: string; newValue: any; oldValue: any }) {
      const devId = Number(change.id);
      const prop = String(change.property || "");
      if (!Number.isFinite(devId) || !prop) return;
      const dev = this.devices?.[devId];
      if (!dev) return;
      const props = (dev.properties && typeof dev.properties === "object") ? dev.properties : {};
      props[prop] = change.newValue;
      dev.properties = props;
      this.devices = { ...this.devices, [devId]: dev };

      this.maybeNotify(devId, dev?.name, prop, change.newValue, change.oldValue);
    },

    maybeNotify(devId: number, devName: string, prop: string, newValue: any, oldValue: any) {
      const settings = useSettingsStore();
      if (!settings.config) return;

      if (settings.config.attentionNotifications && (prop === "dead" || prop === "batteryLevel")) {
        const key = `${devId}:${prop}`;
        const thr = Number(settings.config.lowBatteryThreshold ?? 20);
        if (prop === "dead") {
          const isDead = Boolean(newValue);
          if (isDead && !this.attentionNotified[key]) {
            this.attentionNotified = { ...this.attentionNotified, [key]: true };
            this.notify(`${devName || devId} dead`);
          }
          if (!isDead && this.attentionNotified[key]) {
            const next = { ...this.attentionNotified };
            delete next[key];
            this.attentionNotified = next;
          }
        }
        if (prop === "batteryLevel") {
          const batt = Number(newValue);
          const low = Number.isFinite(batt) && batt <= thr;
          if (low && !this.attentionNotified[key]) {
            this.attentionNotified = { ...this.attentionNotified, [key]: true };
            this.notify(`${devName || devId} battery ${batt}%`);
          }
          if (!low && this.attentionNotified[key]) {
            const next = { ...this.attentionNotified };
            delete next[key];
            this.attentionNotified = next;
          }
        }
      }

      const rules = Array.isArray(settings.config.notifications) ? settings.config.notifications : [];
      for (const r of rules) {
        const rid = Number((r as any).deviceId);
        const rprop = String((r as any).property || "");
        if (!Number.isFinite(rid) || rid !== devId || !rprop || rprop !== prop) continue;
        const cond = String((r as any).condition || "any");
        if (!this.matchCondition(cond, newValue)) continue;
        const msgTmpl = String((r as any).message || "{name} {property} -> {newValue}");
        let msg = msgTmpl;
        msg = msg.split("{name}").join(devName || `Device ${devId}`);
        msg = msg.split("{property}").join(prop);
        msg = msg.split("{newValue}").join(String(newValue));
        msg = msg.split("{oldValue}").join(String(oldValue));
        this.notify(msg);
      }
    },

    matchCondition(condition: string, v: any): boolean {
      const c = (condition || "any").trim();
      if (c === "any") return true;
      if (c === "true") return Boolean(v) === true;
      if (c === "false") return Boolean(v) === false;
      const m = c.match(/^(==|>=|<=|>|<)\s*(-?\d+(\.\d+)?)$/);
      if (!m) return false;
      const op = m[1];
      const target = Number(m[2]);
      const num = Number(v);
      if (!Number.isFinite(num) || !Number.isFinite(target)) return false;
      if (op === "==") return num === target;
      if (op === ">") return num > target;
      if (op === "<") return num < target;
      if (op === ">=") return num >= target;
      if (op === "<=") return num <= target;
      return false;
    },

    async refreshNow() {
      const settings = useSettingsStore();
      if (!settings.isCredsComplete) throw new Error("请先在设置里填写 Host/User/Password");

      const client = this.ensureClient();
      const [devices, rooms, sections, parts, prof, scenes, favColors] = await Promise.all([
        client.getDevices(),
        client.getRooms(),
        client.getSections().catch(() => []),
        client.getPartitions().catch(() => []),
        client.getProfiles().catch(() => ({ activeProfile: null, profiles: [] })),
        client.getScenes().catch(() => []),
        client.getFavoriteColors().catch(() => []),
      ]);

      this.devices = Object.fromEntries((devices || []).filter((d: any) => d && d.id != null).map((d: any) => [Number(d.id), d]));
      this.rooms = Object.fromEntries((rooms || []).filter((r: any) => r && r.id != null).map((r: any) => [Number(r.id), r]));
      this.sections = Object.fromEntries((sections || []).filter((s: any) => s && s.id != null).map((s: any) => [Number(s.id), s]));
      this.partitions = Object.fromEntries((parts || []).filter((p: any) => p && p.id != null).map((p: any) => [Number(p.id), p]));
      this.profiles = Array.isArray(prof?.profiles) ? prof.profiles : [];
      this.activeProfileId = prof?.activeProfile != null ? Number(prof.activeProfile) : null;
      this.scenes = Array.isArray(scenes) ? scenes : [];
      this.favoriteColors = Array.isArray(favColors) ? favColors : [];

      this.setConnected(true);
      this.addActivity({ kind: "refresh", text: "Refresh now" });
    },

    stopSync() {
      this.pollStop = true;
      this.syncing = false;
      if (this.diagTimer != null) {
        clearInterval(this.diagTimer);
        this.diagTimer = null;
      }
    },

    async startSync() {
      const settings = useSettingsStore();
      if (!settings.loaded) settings.load();
      if (!settings.isCredsComplete) return;
      if (this.syncing) return;

      this.pollStop = false;
      this.syncing = true;
      this.pollBackoffSec = 2;

      this.ensureClient();

      await this.refreshNow().catch((e: any) => {
        this.setConnected(false, e?.message || String(e));
      });

      this.runRefreshLoop().catch(() => {});
      this.startDiagLoop();
    },

    async runRefreshLoop() {
      const settings = useSettingsStore();
      const client = this.ensureClient();
      let consecutiveErrors = 0;

      while (!this.pollStop) {
        try {
          const data = await client.refreshStates(this.lastRefresh, settings.config.pollTimeoutSec);
          if (this.pollStop) break;

          this.lastRefresh = Number(data?.last ?? this.lastRefresh);
          const changes: any[] = Array.isArray(data?.changes) ? data.changes : [];
          const events: any[] = Array.isArray(data?.events) ? data.events : [];

          for (const ch of changes) {
            const c = normalizeChange(ch);
            if (c) this.applyChange(c);
          }
          for (const evt of events) {
            const c = normalizeChange(evt);
            if (c) this.applyChange(c);
            await this.handleEvent(evt).catch(() => {});
          }

          consecutiveErrors = 0;
          this.pollBackoffSec = 2;
          this.setConnected(true);
        } catch (e: any) {
          consecutiveErrors += 1;
          if (consecutiveErrors >= 2) this.setConnected(false, e?.message || String(e));
          const waitSec = clamp(this.pollBackoffSec, 2, 60);
          this.pollBackoffSec = clamp(this.pollBackoffSec * 2, 2, 60);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
        }
      }
    },

    async handleEvent(evt: any) {
      if (!evt || typeof evt !== "object") return;

      const { type: t, data } = unpackEvent(evt);
      if (!t) return;

      if (t === "AlarmPartitionArmedEvent" || t === "AlarmPartitionDisarmedEvent" || t === "AlarmPartitionBreachedEvent" || t === "AlarmPartitionPendingEvent") {
        const pid = Number((data as any)?.partitionId ?? (data as any)?.id);
        if (Number.isFinite(pid)) {
          const p = this.partitions?.[pid] || { id: pid };
          const armed = t === "AlarmPartitionArmedEvent" ? true : t === "AlarmPartitionDisarmedEvent" ? false : p.armed;
          const breached = t === "AlarmPartitionBreachedEvent" ? true : p.breached;
          const pending = t === "AlarmPartitionPendingEvent" ? true : p.pending;
          this.partitions = { ...this.partitions, [pid]: { ...p, armed, breached, pending } };
          this.addActivity({ kind: "alarm", text: `${t} #${pid}` });
        }
        return;
      }

      if (t === "ActiveProfileChangedEvent") {
        const id = Number((data as any)?.profileId);
        if (Number.isFinite(id)) {
          this.activeProfileId = id;
          this.addActivity({ kind: "profile", text: `Active profile -> ${id}` });
        }
        return;
      }

      if (t === "PluginProcessCrashedEvent") {
        const pid = Number((data as any)?.id ?? 0);
        this.addActivity({ kind: "qa_crash", text: `PluginProcessCrashedEvent ${pid || ""}`.trim() });
        const settings = useSettingsStore();
        if (settings.config.qaCrashNotifications && pid && !this.qaCrashNotified[pid]) {
          this.qaCrashNotified = { ...this.qaCrashNotified, [pid]: true };
          this.notify(`QA crashed ${pid}`);
        }
        return;
      }

      if (t === "DevicePropertyUpdatedEvent") {
        const devId = Number((data as any)?.id);
        const prop = String((data as any)?.property || "");
        if (!Number.isFinite(devId) || !prop) return;
        const dev = this.devices?.[devId];
        const name = dev?.name || `Device ${devId}`;
        this.addActivity({ kind: "device", devId, devName: name, text: `${prop} -> ${String((data as any)?.newValue)}` });
        return;
      }
    },

    startDiagLoop() {
      const settings = useSettingsStore();
      if (this.diagTimer != null) return;

      const tick = async () => {
        if (this.pollStop) return;
        const client = this.ensureClient();
        const [diag, debug] = await Promise.all([
          client.getDiagnostics().catch(() => null),
          client.getDebugMessages({ types: ["warning", "error", "fatal"], offset: 50, last: this.debugNextLast || undefined }).catch(() => null),
        ]);
        if (diag) this.updateDiagnostics(diag);
        if (debug && typeof debug === "object") {
          this.debugNextLast = Number((debug as any).nextLast ?? this.debugNextLast);
          const added = this.mergeDebugMessages((debug as any).messages || []);
          if (settings.config.qaErrorNotifications && added.length) {
            for (const m of added) {
              const tag = String(m?.tag || "");
              const type = String(m?.type || "");
              if (!tag || !["error", "fatal"].includes(type)) continue;
              const last = this.qaLastNotifiedSec[tag] || 0;
              const now = nowSec();
              if (now - last < Number(settings.config.qaErrorThrottleSec || 60)) continue;
              this.qaLastNotifiedSec = { ...this.qaLastNotifiedSec, [tag]: now };
              this.notify(`${tag} ${type}`);
            }
          }
        }

        const now = nowSec();
        if (!this.lastStructureRefreshSec) this.lastStructureRefreshSec = now;
        if (now - this.lastStructureRefreshSec >= 300) {
          const [devices, rooms, sections] = await Promise.all([
            client.getDevices().catch(() => null),
            client.getRooms().catch(() => null),
            client.getSections().catch(() => null),
          ]);
          if (devices) this.devices = Object.fromEntries((devices || []).filter((d: any) => d && d.id != null).map((d: any) => [Number(d.id), d]));
          if (rooms) this.rooms = Object.fromEntries((rooms || []).filter((r: any) => r && r.id != null).map((r: any) => [Number(r.id), r]));
          if (sections) this.sections = Object.fromEntries((sections || []).filter((s: any) => s && s.id != null).map((s: any) => [Number(s.id), s]));
          this.lastStructureRefreshSec = now;
        }

        if (!this.lastProfilesRefreshSec) this.lastProfilesRefreshSec = now;
        if (now - this.lastProfilesRefreshSec >= 30) {
          const prof = await client.getProfiles().catch(() => null);
          if (prof) {
            this.profiles = Array.isArray((prof as any).profiles) ? (prof as any).profiles : [];
            this.activeProfileId = (prof as any).activeProfile != null ? Number((prof as any).activeProfile) : this.activeProfileId;
          }
          this.lastProfilesRefreshSec = now;
        }
      };

      const intervalMs = clamp(Number(settings.config.diagnosticsPollSec || 10), 5, 60) * 1000;
      this.diagTimer = setInterval(() => {
        tick().catch(() => {});
      }, intervalMs) as unknown as number;

      tick().catch(() => {});
    },

    async runDeviceAction(fn: () => Promise<any>) {
      try {
        await fn();
      } catch (e: any) {
        uni.showToast({ title: e?.message || "操作失败", icon: "none" });
        throw e;
      }
    },

    toggleSwitch(deviceId: number, nextOn: boolean) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => (nextOn ? client.turnOn(deviceId) : client.turnOff(deviceId)));
    },

    setDimmerValue(deviceId: number, v: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.setValue(deviceId, clamp(Math.round(v), 0, 100)));
    },

    shutterOpen(deviceId: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.callAction(deviceId, "open"));
    },

    shutterClose(deviceId: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.callAction(deviceId, "close"));
    },

    shutterStop(deviceId: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.callAction(deviceId, "stop"));
    },

    setThermostatMode(deviceId: number, mode: "Auto" | "Off" | "Heat" | "Cool") {
      const client = this.ensureClient();
      const m = String(mode) as "Auto" | "Off" | "Heat" | "Cool";
      const dev = this.devices?.[Number(deviceId)];
      if (dev) {
        const props = (dev.properties && typeof dev.properties === "object") ? dev.properties : {};
        props.thermostatMode = m;
        dev.properties = props;
        this.devices = { ...this.devices, [Number(deviceId)]: dev };
      }
      return this.runDeviceAction(() => client.setThermostatMode(deviceId, m));
    },

    setThermostatSetpoint(deviceId: number, temp: number, mode: "Auto" | "Heat" | "Cool") {
      const client = this.ensureClient();
      const t = Number(temp);
      const m = String(mode) as "Auto" | "Heat" | "Cool";

      const dev = this.devices?.[Number(deviceId)];
      if (dev) {
        const props = (dev.properties && typeof dev.properties === "object") ? dev.properties : {};
        if (m === "Auto") props.autoThermostatSetpoint = t;
        if (m === "Heat") props.heatingThermostatSetpoint = t;
        if (m === "Cool") props.coolingThermostatSetpoint = t;
        dev.properties = props;
        this.devices = { ...this.devices, [Number(deviceId)]: dev };
      }

      if (m === "Auto") return this.runDeviceAction(() => client.setAutoThermostatSetpoint(deviceId, t));
      return this.runDeviceAction(() => client.setThermostatSetpoint(deviceId, t, m));
    },

    setFanMode(deviceId: number, mode: string) {
      const client = this.ensureClient();
      const dev = this.devices?.[Number(deviceId)];
      if (dev) {
        const props = (dev.properties && typeof dev.properties === "object") ? dev.properties : {};
        props.fanMode = String(mode);
        dev.properties = props;
        this.devices = { ...this.devices, [Number(deviceId)]: dev };
      }
      return this.runDeviceAction(() => client.setFanMode(deviceId, String(mode)));
    },

    setFanSpeed(deviceId: number, speed: number | string) {
      const client = this.ensureClient();
      const dev = this.devices?.[Number(deviceId)];
      if (dev) {
        const props = (dev.properties && typeof dev.properties === "object") ? dev.properties : {};
        props.fanSpeed = speed;
        dev.properties = props;
        this.devices = { ...this.devices, [Number(deviceId)]: dev };
      }
      return this.runDeviceAction(() => client.setFanSpeed(deviceId, speed));
    },

    setThermostatFanMode(deviceId: number, mode: string) {
      const client = this.ensureClient();
      const dev = this.devices?.[Number(deviceId)];
      if (dev) {
        const props = (dev.properties && typeof dev.properties === "object") ? dev.properties : {};
        const m = String(mode);
        props.thermostatFanOff = m === "Off";
        if (m !== "Off") props.thermostatFanMode = m;
        dev.properties = props;
        this.devices = { ...this.devices, [Number(deviceId)]: dev };
      }
      return this.runDeviceAction(() => client.callAction(deviceId, "setThermostatFanMode", [String(mode)]));
    },

    setThermostat(deviceId: number, temp: number, mode: "Heat" | "Cool") {
      return this.setThermostatSetpoint(deviceId, temp, mode);
    },

    runScene(sceneId: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.runScene(sceneId));
    },

    async setActiveProfile(profileId: number) {
      const client = this.ensureClient();
      const id = Number(profileId);
      await this.runDeviceAction(() => client.setActiveProfile(id));
      this.activeProfileId = id;
      this.addActivity({ kind: "profile", text: `Active profile -> ${id}` });
    },

    armPartition(partitionId: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.armPartition(partitionId));
    },

    disarmPartition(partitionId: number) {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.disarmPartition(partitionId));
    },

    armAll() {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.armAllPartitions());
    },

    disarmAll() {
      const client = this.ensureClient();
      return this.runDeviceAction(() => client.disarmAllPartitions());
    },
  },
});
