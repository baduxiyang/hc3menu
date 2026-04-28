import { defineStore } from "pinia";

export type HC3Credentials = {
  host: string;
  port: number;
  https: boolean;
  user: string;
  password: string;
  pin: string;
};

export type NotificationRule = {
  deviceId: number;
  property: string;
  condition: string;
  message: string;
};

export type AppConfig = {
  favorites: number[];
  notifications: NotificationRule[];
  pollTimeoutSec: number;
  attentionNotifications: boolean;
  lowBatteryThreshold: number;
  qaErrorNotifications: boolean;
  qaErrorThrottleSec: number;
  qaCrashNotifications: boolean;
  diagnosticsPollSec: number;
  debugMessagesPollSec: number;
};

const STORAGE_KEYS = {
  creds: "hc3menu.creds",
  config: "hc3menu.config",
};

const defaultCreds = (): HC3Credentials => ({
  host: "",
  port: 80,
  https: false,
  user: "",
  password: "",
  pin: "",
});

const defaultConfig = (): AppConfig => ({
  favorites: [],
  notifications: [],
  pollTimeoutSec: 35,
  attentionNotifications: true,
  lowBatteryThreshold: 20,
  qaErrorNotifications: true,
  qaErrorThrottleSec: 60,
  qaCrashNotifications: true,
  diagnosticsPollSec: 10,
  debugMessagesPollSec: 10,
});

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    creds: defaultCreds(),
    config: defaultConfig(),
    loaded: false,
  }),
  getters: {
    baseUrl: (s): string => {
      const scheme = s.creds.https ? "https" : "http";
      const host = (s.creds.host || "").trim();
      if (!host) return "";
      const port = Number.isFinite(s.creds.port) ? s.creds.port : 80;
      return `${scheme}://${host}:${port}/api`;
    },
    isCredsComplete: (s): boolean => {
      return Boolean((s.creds.host || "").trim() && (s.creds.user || "").trim() && s.creds.password);
    },
  },
  actions: {
    load() {
      const rawCreds = uni.getStorageSync(STORAGE_KEYS.creds);
      const rawCfg = uni.getStorageSync(STORAGE_KEYS.config);

      if (rawCreds && typeof rawCreds === "object") {
        this.creds = { ...defaultCreds(), ...(rawCreds as Partial<HC3Credentials>) };
      }
      if (rawCfg && typeof rawCfg === "object") {
        this.config = { ...defaultConfig(), ...(rawCfg as Partial<AppConfig>) };
        this.config.favorites = Array.isArray(this.config.favorites)
          ? this.config.favorites.map((x) => Number(x)).filter((x) => Number.isFinite(x))
          : [];
        this.config.notifications = Array.isArray(this.config.notifications) ? this.config.notifications : [];
      }

      this.loaded = true;
    },
    saveCreds(next: Partial<HC3Credentials>) {
      this.creds = { ...this.creds, ...next };
      uni.setStorageSync(STORAGE_KEYS.creds, this.creds);
    },
    saveConfig(next: Partial<AppConfig>) {
      this.config = { ...this.config, ...next };
      uni.setStorageSync(STORAGE_KEYS.config, this.config);
    },
    toggleFavorite(deviceId: number) {
      const id = Number(deviceId);
      const set = new Set<number>(this.config.favorites || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      this.saveConfig({ favorites: Array.from(set) });
    },
    setFavoritesOrder(ids: number[]) {
      this.saveConfig({ favorites: (ids || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)) });
    },
  },
});

