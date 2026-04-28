<script setup lang="ts">
import { computed } from "vue"
import { onPullDownRefresh } from "@dcloudio/uni-app"
import DeviceRow from "../../components/DeviceRow.vue"
import { useHc3Store } from "../../stores/hc3"
import { useSettingsStore } from "../../stores/settings"

const hc3 = useHc3Store()
const settings = useSettingsStore()

const attentionDevices = computed(() => {
  const th = Number(settings.low_battery_threshold || 20)
  return hc3.deviceList.filter((d) => {
    const props = d.properties || {}
    const dead = Boolean(props.dead)
    const batt = props.batteryLevel
    let low = false
    if (batt != null) {
      const v = Number(batt)
      low = Number.isFinite(v) && v <= th
    }
    return dead || low
  })
})

function openDevice(id: number) {
  uni.navigateTo({ url: `/pages/device/detail?id=${id}` })
}

function toggleFavorite(id: number) {
  settings.toggleFavorite(id)
  settings.save()
}

async function refresh() {
  await hc3.refreshNow()
  uni.stopPullDownRefresh()
}

onPullDownRefresh(refresh)
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <view class="title">关注</view>
        <button size="mini" @click="refresh">刷新</button>
      </view>
      <view v-if="attentionDevices.length === 0" class="muted">暂无需要关注的设备</view>
      <DeviceRow
        v-for="d in attentionDevices"
        :key="d.id"
        :device="d"
        :roomName="hc3.roomName(d.roomID)"
        :favorite="settings.favorites.includes(Number(d.id))"
        @open="openDevice"
        @toggleFavorite="toggleFavorite"
      />
    </view>

    <view style="height: 18rpx" />

    <view class="card">
      <button @click="uni.navigateTo({ url: '/pages/activity/index' })">活动</button>
      <button @click="uni.navigateTo({ url: '/pages/debug/index' })" style="margin-top: 12rpx">Debug messages</button>
      <button @click="uni.navigateTo({ url: '/pages/diagnostics/index' })" style="margin-top: 12rpx">诊断</button>
      <button @click="uni.navigateTo({ url: '/pages/alarm/index' })" style="margin-top: 12rpx">报警</button>
      <button @click="uni.navigateTo({ url: '/pages/profiles/index' })" style="margin-top: 12rpx">情景/配置</button>
    </view>
  </view>
</template>

