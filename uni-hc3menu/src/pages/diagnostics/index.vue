<script setup lang="ts">
import { computed } from "vue"
import { onPullDownRefresh } from "@dcloudio/uni-app"
import { useHc3Store } from "../../stores/hc3"

const hc3 = useHc3Store()
const diag = computed(() => hc3.diagnostics || {})

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
        <view class="title">诊断</view>
        <button size="mini" @click="refresh">刷新</button>
      </view>
      <view style="height: 12rpx" />
      <view class="muted">cpuLoad: {{ JSON.stringify(diag.cpuLoad || []) }}</view>
      <view class="muted" style="margin-top: 8rpx">memory: {{ JSON.stringify(diag.memory || {}) }}</view>
      <view class="muted" style="margin-top: 8rpx">storage: {{ JSON.stringify(diag.storage || {}) }}</view>
      <view style="height: 12rpx" />
      <view class="muted" style="white-space: pre-wrap">{{ JSON.stringify(diag, null, 2) }}</view>
    </view>
  </view>
</template>

