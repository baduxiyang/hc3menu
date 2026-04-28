<script setup lang="ts">
import { computed } from "vue"
import { useHc3Store } from "../../stores/hc3"

const hc3 = useHc3Store()
const items = computed(() => hc3.activity || [])

function fmt(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <view class="title">活动</view>
        <button size="mini" @click="hc3.clearActivity()">清空</button>
      </view>
      <view v-if="items.length === 0" class="muted" style="margin-top: 10rpx">暂无记录</view>
      <view v-for="(it, idx) in items" :key="idx" class="act-row">
        <view>
          <view>{{ it.text }}</view>
          <view class="muted">{{ fmt(it.ts) }} · {{ it.kind }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.act-row {
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
</style>
