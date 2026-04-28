<script setup lang="ts">
import { computed, ref } from "vue"
import DeviceRow from "../../components/DeviceRow.vue"
import { useHc3Store } from "../../stores/hc3"
import { useSettingsStore } from "../../stores/settings"

const hc3 = useHc3Store()
const settings = useSettingsStore()
const q = ref("")

const results = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return { devices: [], scenes: [] }
  const devices = hc3.deviceList.filter((d) => String(d.name || "").toLowerCase().includes(term)).slice(0, 30)
  const scenes = (hc3.scenes || []).filter((s) => String(s.name || "").toLowerCase().includes(term)).slice(0, 30)
  return { devices, scenes }
})

function openDevice(id: number) {
  uni.navigateTo({ url: `/pages/device/detail?id=${id}` })
}

function toggleFavorite(id: number) {
  settings.toggleFavorite(id)
  settings.save()
}

async function runScene(id: number) {
  try {
    await hc3.runScene(id)
    uni.showToast({ title: "已执行", icon: "none" })
  } catch (e: any) {
    uni.showToast({ title: e?.message || "失败", icon: "none" })
  }
}
</script>

<template>
  <view class="page">
    <view class="card">
      <input v-model="q" placeholder="搜索设备/场景" />
    </view>

    <view style="height: 18rpx" />

    <view class="card">
      <view class="title" style="font-size: 30rpx">设备</view>
      <view v-if="results.devices.length === 0" class="muted" style="margin-top: 10rpx">无结果</view>
      <DeviceRow
        v-for="d in results.devices"
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
      <view class="title" style="font-size: 30rpx">场景</view>
      <view v-if="results.scenes.length === 0" class="muted" style="margin-top: 10rpx">无结果</view>
      <view v-for="s in results.scenes" :key="s.id" class="scene-row">
        <view>
          <view>{{ s.name || ("Scene " + s.id) }}</view>
          <view class="muted">id={{ s.id }}</view>
        </view>
        <button size="mini" type="primary" @click="runScene(Number(s.id))">运行</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.scene-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
</style>

