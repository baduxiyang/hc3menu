export type Hc3Credentials = {
  host: string
  port: number
  https: boolean
  user: string
  password: string
  pin?: string
}

export type Hc3Device = {
  id: number
  name?: string
  roomID?: number
  type?: string
  interfaces?: string[]
  properties?: Record<string, any>
  [k: string]: any
}

export type Hc3Room = {
  id: number
  name?: string
  [k: string]: any
}

export type Hc3Partition = {
  id: number
  name?: string
  armed?: boolean
  breached?: boolean
  [k: string]: any
}

export type Hc3ProfilesResponse = {
  activeProfile: number | null
  profiles: Array<Record<string, any>>
}

export type Hc3DebugMessage = {
  id: number
  timestamp?: number
  type?: string
  tag?: string
  message?: string
  [k: string]: any
}

export type Hc3FavoriteColor = {
  id: number
  name?: string
  components?: Record<string, any>
  r?: number
  g?: number
  b?: number
  w?: number
  [k: string]: any
}

export type Hc3DebugMessagesResponse = {
  nextLast: number
  messages: Hc3DebugMessage[]
}

export type Hc3RefreshStates = {
  last: number
  changes: Array<Record<string, any>>
  events: Array<Record<string, any>>
}

export type NormalizedChange = {
  id?: number
  property?: string
  newValue?: any
  oldValue?: any
  _event_type?: string
  [k: string]: any
}
