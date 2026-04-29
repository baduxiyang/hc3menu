import type { HC3Credentials } from "@/stores/settings";
import { base64Encode } from "@/utils/base64";

export class HC3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HC3Error";
  }
}

const buildBaseUrl = (creds: HC3Credentials): string => {
  const scheme = creds.https ? "https" : "http";
  const host = (creds.host || "").trim();
  const port = Number.isFinite(creds.port) ? creds.port : 80;
  return `${scheme}://${host}:${port}/api`;
};

const joinUrl = (baseUrl: string, path: string): string => {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${baseUrl}${path}`;
};

type RequestOptions = {
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
};

export class HC3Client {
  private creds: HC3Credentials;

  constructor(creds: HC3Credentials) {
    this.creds = creds;
  }

  setCredentials(creds: HC3Credentials) {
    this.creds = creds;
  }

  private async request<T>(method: UniApp.RequestOptions["method"], path: string, body?: any, opts?: RequestOptions) {
    const baseUrl = buildBaseUrl(this.creds);
    if (!this.creds.host || !this.creds.user || !this.creds.password) {
      throw new HC3Error("缺少连接信息（Host/User/Password）");
    }

    const auth = base64Encode(`${this.creds.user}:${this.creds.password}`);

    const res = await uni.request({
      url: joinUrl(baseUrl, path),
      method,
      data: body,
      timeout: opts?.timeoutMs ?? 10_000,
      header: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
        "X-Fibaro-Version": "2",
        ...(opts?.extraHeaders || {}),
      },
    });

    const status = (res.statusCode ?? 0) as number;
    if (status >= 400) {
      const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      throw new HC3Error(`${method} ${path} -> HTTP ${status}: ${text.slice(0, 200)}`);
    }

    return res.data as T;
  }

  getDevices(): Promise<any[]> {
    return this.request<any[]>("GET", "/devices").then((x) => (Array.isArray(x) ? x : []));
  }

  getRooms(): Promise<any[]> {
    return this.request<any[]>("GET", "/rooms").then((x) => (Array.isArray(x) ? x : []));
  }

  getDevice(deviceId: number): Promise<any> {
    return this.request<any>("GET", `/devices/${Number(deviceId)}`);
  }

  callAction(deviceId: number, action: string, args?: any[]): Promise<any> {
    return this.request<any>("POST", `/devices/${Number(deviceId)}/action/${action}`, { args: args || [] });
  }

  turnOn(deviceId: number) {
    return this.callAction(deviceId, "turnOn");
  }

  turnOff(deviceId: number) {
    return this.callAction(deviceId, "turnOff");
  }

  setValue(deviceId: number, value: any) {
    return this.callAction(deviceId, "setValue", [value]);
  }

  setThermostatSetpoint(deviceId: number, value: number, mode: "Heat" | "Cool" = "Heat") {
    const action = mode === "Heat" ? "setHeatingThermostatSetpoint" : "setCoolingThermostatSetpoint";
    return this.callAction(deviceId, action, [Number(value)]);
  }

  setAutoThermostatSetpoint(deviceId: number, value: number) {
    return this.callAction(deviceId, "setAutoThermostatSetpoint", [Number(value)]);
  }

  setThermostatMode(deviceId: number, mode: string) {
    return this.callAction(deviceId, "setThermostatMode", [String(mode)]);
  }

  setFanMode(deviceId: number, mode: string) {
    return this.callAction(deviceId, "setFanMode", [String(mode)]);
  }

  setFanSpeed(deviceId: number, speed: number | string) {
    return this.callAction(deviceId, "setFanSpeed", [speed]);
  }

  setColor(deviceId: number, r: number, g: number, b: number, w: number = 0) {
    return this.callAction(deviceId, "setColor", [Number(r), Number(g), Number(b), Number(w)]);
  }

  setColorComponents(deviceId: number, components: Record<string, any>) {
    return this.callAction(deviceId, "setColorComponents", [components]);
  }

  async getFavoriteColors(): Promise<any[]> {
    const tryPaths = ["/panels/favoriteColors/v2", "/panels/favoriteColors"];
    for (const p of tryPaths) {
      try {
        const data = await this.request<any>("GET", p);
        if (!data) continue;
        if (Array.isArray(data)) return data;
        if (typeof data === "object" && data && Array.isArray((data as any).items)) return (data as any).items;
      } catch {
        continue;
      }
    }
    return [];
  }

  private pinHeaders(): Record<string, string> {
    const pin = (this.creds.pin || "").trim();
    return pin ? { "Fibaro-User-PIN": pin } : {};
  }

  getPartitions(): Promise<any[]> {
    return this.request<any[]>("GET", "/alarms/v1/partitions").then((x) => (Array.isArray(x) ? x : []));
  }

  armPartition(partitionId: number) {
    return this.request<any>("POST", `/alarms/v1/partitions/${Number(partitionId)}/actions/arm`, {}, { extraHeaders: this.pinHeaders() });
  }

  disarmPartition(partitionId: number) {
    return this.request<any>("DELETE", `/alarms/v1/partitions/${Number(partitionId)}/actions/arm`, undefined, { extraHeaders: this.pinHeaders() });
  }

  armAllPartitions() {
    return this.request<any>("POST", "/alarms/v1/partitions/actions/arm", {}, { extraHeaders: this.pinHeaders() });
  }

  disarmAllPartitions() {
    return this.request<any>("DELETE", "/alarms/v1/partitions/actions/arm", undefined, { extraHeaders: this.pinHeaders() });
  }

  async getProfiles(): Promise<{ activeProfile: number | null; profiles: any[] }> {
    const data = await this.request<any>("GET", "/profiles");
    if (Array.isArray(data)) return { activeProfile: null, profiles: data };
    if (typeof data === "object" && data) {
      return {
        activeProfile: (data as any).activeProfile ?? null,
        profiles: Array.isArray((data as any).profiles) ? (data as any).profiles : [],
      };
    }
    return { activeProfile: null, profiles: [] };
  }

  setActiveProfile(profileId: number) {
    return this.request<any>("POST", `/profiles/activeProfile/${Number(profileId)}`, {});
  }

  getScenes(): Promise<any[]> {
    return this.request<any[]>("GET", "/scenes").then((x) => (Array.isArray(x) ? x : []));
  }

  runScene(sceneId: number) {
    return this.request<any>("POST", `/scenes/${Number(sceneId)}/execute`, {});
  }

  async getDiagnostics(): Promise<any> {
    const data = await this.request<any>("GET", "/diagnostics");
    return typeof data === "object" && data ? data : {};
  }

  async getDebugMessages(opts?: { types?: string[]; offset?: number; last?: number; from?: number; to?: number }): Promise<any> {
    const params: string[] = [];
    if (opts?.types && opts.types.length) params.push(`types=${encodeURIComponent(opts.types.join(","))}`);
    if (opts?.last != null) params.push(`last=${Number(opts.last)}`);
    if (opts?.from != null) params.push(`from=${Number(opts.from)}`);
    if (opts?.to != null) params.push(`to=${Number(opts.to)}`);
    params.push(`offset=${Number(opts?.offset ?? 20)}`);
    const qs = `?${params.join("&")}`;
    const data = await this.request<any>("GET", `/debugMessages${qs}`);
    if (typeof data !== "object" || !data) return { nextLast: 0, messages: [] };
    return {
      nextLast: Number((data as any).nextLast ?? 0),
      messages: Array.isArray((data as any).messages) ? (data as any).messages : [],
    };
  }

  async refreshStates(last: number, timeoutSec: number): Promise<any> {
    const timeoutMs = Math.max(5_000, Math.floor(timeoutSec * 1000));
    const data = await this.request<any>("GET", `/refreshStates?last=${Number(last)}`, undefined, { timeoutMs });
    if (typeof data !== "object" || !data) return { last, changes: [], events: [] };
    return {
      last: Number((data as any).last ?? last),
      changes: Array.isArray((data as any).changes) ? (data as any).changes : [],
      events: Array.isArray((data as any).events) ? (data as any).events : [],
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const info = await this.request<any>("GET", "/settings/info", undefined, { timeoutMs: 5_000 });
      const name = (info || {}).serialNumber || (info || {}).hcName || "HC3";
      return { ok: true, message: `已连接到 ${name}` };
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) };
    }
  }
}
