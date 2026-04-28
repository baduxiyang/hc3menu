import { defineStore } from "pinia"
import type { AppSettings, NotificationRule } from "../types/settings"
import type { Hc3Credentials } from "../types/hc3"

const STORAGE_KEY = "hc3menu.settings.v1"

function defaultCreds(): Hc3Credentials {
  return {
    host: "",
    port: 80,
    https: false,
    user: "",
    password: "",
    pin: "",
  }
}

function defaultSettings(): AppSettings {
  return {
    creds: defaultCreds(),
    favorites: [],
    notifications: [
      {
        device_id: 0,
        property: "value",
        condition: "any",
        message: "{name} {property} -> {newValue}",
      },
    ],
    poll_timeout_sec: 35,
    attention_notifications: true,
    low_battery_threshold: 20,
    qa_error_notifications: true,
    qa_error_throttle_sec: 60,
    qa_crash_notifications: true,
  }
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    ...defaultSettings(),
    loaded: false,
  }),
  getters: {
    hasCreds(state): boolean {
      return Boolean(state.creds.host && state.creds.user && state.creds.password)
    },
  },
  actions: {
    async load() {
      const raw = uni.getStorageSync(STORAGE_KEY)
      if (raw) {
        try {
          const data = typeof raw === "string" ? JSON.parse(raw) : raw
          this.creds = { ...defaultCreds(), ...(data.creds || {}) }
          this.favorites = Array.isArray(data.favorites) ? data.favorites.map((x: any) => Number(x)) : []
          this.notifications = Array.isArray(data.notifications) ? (data.notifications as NotificationRule[]) : []
          this.poll_timeout_sec = Number(data.poll_timeout_sec || 35)
          this.attention_notifications = Boolean(data.attention_notifications ?? true)
          this.low_battery_threshold = Number(data.low_battery_threshold ?? 20)
          this.qa_error_notifications = Boolean(data.qa_error_notifications ?? true)
          this.qa_error_throttle_sec = Number(data.qa_error_throttle_sec ?? 60)
          this.qa_crash_notifications = Boolean(data.qa_crash_notifications ?? true)
        } catch {}
      }
      this.loaded = true
    },
    async save() {
      const payload: AppSettings = {
        creds: this.creds,
        favorites: this.favorites,
        notifications: this.notifications,
        poll_timeout_sec: this.poll_timeout_sec,
        attention_notifications: this.attention_notifications,
        low_battery_threshold: this.low_battery_threshold,
        qa_error_notifications: this.qa_error_notifications,
        qa_error_throttle_sec: this.qa_error_throttle_sec,
        qa_crash_notifications: this.qa_crash_notifications,
      }
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(payload))
    },
    setCreds(creds: Hc3Credentials) {
      this.creds = { ...creds }
    },
    toggleFavorite(deviceId: number) {
      const id = Number(deviceId)
      const idx = this.favorites.indexOf(id)
      if (idx >= 0) this.favorites.splice(idx, 1)
      else this.favorites.unshift(id)
    },
    setFavorites(ids: number[]) {
      this.favorites = ids.map((x) => Number(x))
    },
  },
})

