<script setup lang="ts">
import { onHide, onLaunch, onShow } from "@dcloudio/uni-app"
import { useHc3Store } from "./stores/hc3"
import { useSettingsStore } from "./stores/settings"

const settings = useSettingsStore()
const hc3 = useHc3Store()

onLaunch(async () => {
  await settings.load()
  if (settings.hasCreds) {
    await hc3.connect(settings.creds)
  }
})

onShow(() => {
  hc3.resume()
})

onHide(() => {
  hc3.pause()
})
</script>

<template>
  <slot />
</template>

<style lang="scss">
@import "./uni.scss";
</style>

