import type { Hc3Credentials } from "./hc3"

export type NotificationRule = {
  device_id: number
  property: string
  condition: string
  message: string
}

export type AppSettings = {
  creds: Hc3Credentials
  favorites: number[]
  notifications: NotificationRule[]
  poll_timeout_sec: number
  attention_notifications: boolean
  low_battery_threshold: number
  qa_error_notifications: boolean
  qa_error_throttle_sec: number
  qa_crash_notifications: boolean
}

