import { base64Encode } from "../utils/base64"
import type {
  Hc3Credentials,
  Hc3DebugMessagesResponse,
  Hc3Device,
  Hc3FavoriteColor,
  Hc3Partition,
  Hc3ProfilesResponse,
  Hc3RefreshStates,
  Hc3Room,
} from "../types/hc3"

export class Hc3ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "Hc3ApiError"
  }
}

export class Hc3ApiClient {
  private creds: Hc3Credentials

  constructor(creds: Hc3Credentials) {
    this.creds = creds
  }

  setCredentials(creds: Hc3Credentials) {
    this.creds = creds
  }

  private baseUrl(): string {
    const scheme = this.creds.https ? "https" : "http"
    const port = this.creds.port || (this.creds.https ? 443 : 80)
    return `${scheme}://${this.creds.host}:${port}/api`
  }

  private authHeaders(): Record<string, string> {
    const token = base64Encode(`${this.creds.user}:${this.creds.password}`)
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${token}`,
      "X-Fibaro-Version": "2",
    }
    const pin = (this.creds.pin || "").trim()
    if (pin) headers["Fibaro-User-PIN"] = pin
    return headers
  }

  private async request<T>(
    method: UniApp.RequestOptions["method"],
    path: string,
    opts?: { data?: any; timeoutMs?: number }
  ): Promise<T> {
    const url = this.baseUrl() + (path.startsWith("/") ? path : `/${path}`)
    const headers = this.authHeaders()

    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url,
        method,
        data: opts?.data,
        timeout: opts?.timeoutMs,
        header: headers,
        success: resolve,
        fail: reject,
      })
    }).catch((e: any) => {
      throw new Hc3ApiError(`${method} ${path} failed: ${e?.errMsg || String(e)}`)
    })

    if (res.statusCode >= 400) {
      throw new Hc3ApiError(`${method} ${path} -> HTTP ${res.statusCode}`)
    }
    return res.data as T
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const info = await this.request<any>("GET", "/settings/info", { timeoutMs: 5000 })
      const name = info?.serialNumber || info?.hcName || "HC3"
      return { ok: true, message: `Connected to ${name}` }
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) }
    }
  }

  async getDevices(): Promise<Hc3Device[]> {
    const data = await this.request<any>("GET", "/devices")
    return Array.isArray(data) ? data : []
  }

  async getRooms(): Promise<Hc3Room[]> {
    const data = await this.request<any>("GET", "/rooms")
    return Array.isArray(data) ? data : []
  }

  async callAction(deviceId: number, action: string, args?: any[]): Promise<any> {
    return this.request<any>("POST", `/devices/${deviceId}/action/${action}`, {
      data: { args: args || [] },
    })
  }

  async getPartitions(): Promise<Hc3Partition[]> {
    const data = await this.request<any>("GET", "/alarms/v1/partitions")
    return Array.isArray(data) ? data : []
  }

  async armPartition(partitionId: number): Promise<any> {
    return this.request<any>("POST", `/alarms/v1/partitions/${partitionId}/actions/arm`, { data: {} })
  }

  async disarmPartition(partitionId: number): Promise<any> {
    return this.request<any>("DELETE", `/alarms/v1/partitions/${partitionId}/actions/arm`)
  }

  async armAllPartitions(): Promise<any> {
    return this.request<any>("POST", "/alarms/v1/partitions/actions/arm", { data: {} })
  }

  async disarmAllPartitions(): Promise<any> {
    return this.request<any>("DELETE", "/alarms/v1/partitions/actions/arm")
  }

  async getProfiles(): Promise<Hc3ProfilesResponse> {
    const data = await this.request<any>("GET", "/profiles")
    if (Array.isArray(data)) return { activeProfile: null, profiles: data }
    if (data && typeof data === "object") return { activeProfile: data.activeProfile ?? null, profiles: data.profiles || [] }
    return { activeProfile: null, profiles: [] }
  }

  async setActiveProfile(profileId: number): Promise<any> {
    return this.request<any>("POST", `/profiles/activeProfile/${profileId}`, { data: {} })
  }

  async getScenes(): Promise<any[]> {
    const data = await this.request<any>("GET", "/scenes")
    return Array.isArray(data) ? data : []
  }

  async runScene(sceneId: number): Promise<any> {
    return this.request<any>("POST", `/scenes/${sceneId}/execute`, { data: {} })
  }

  async getDiagnostics(): Promise<Record<string, any>> {
    const data = await this.request<any>("GET", "/diagnostics")
    return data && typeof data === "object" ? data : {}
  }

  async getFavoriteColors(): Promise<Hc3FavoriteColor[]> {
    const paths = ["/panels/favoriteColors/v2", "/panels/favoriteColors"]
    for (const path of paths) {
      try {
        const data = await this.request<any>("GET", path)
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
        if (Array.isArray(list)) return list as Hc3FavoriteColor[]
      } catch {}
    }
    return []
  }

  async getDebugMessages(offset = 100): Promise<Hc3DebugMessagesResponse> {
    const data = await this.request<any>("GET", `/debugMessages?offset=${offset}`)
    if (!data || typeof data !== "object") return { nextLast: 0, messages: [] }
    return { nextLast: Number(data.nextLast || 0), messages: Array.isArray(data.messages) ? data.messages : [] }
  }

  async refreshStates(last: number, pollTimeoutSec = 35): Promise<Hc3RefreshStates> {
    const timeoutMs = Math.max(5, pollTimeoutSec + 5) * 1000
    const data = await this.request<any>("GET", `/refreshStates?last=${last}`, { timeoutMs })
    if (!data || typeof data !== "object") return { last, changes: [], events: [] }
    return {
      last: Number(data.last || last),
      changes: Array.isArray(data.changes) ? data.changes : [],
      events: Array.isArray(data.events) ? data.events : [],
    }
  }
}
