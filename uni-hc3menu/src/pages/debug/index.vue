<script setup lang="ts">
import { computed, ref } from "vue"
import { useHc3Store } from "../../stores/hc3"

const hc3 = useHc3Store()
const level = ref<"all" | "error" | "warning">("all")
const q = ref("")

const rows = computed(() => {
  const term = q.value.trim().toLowerCase()
  return (hc3.debugMessages || []).filter((m) => {
    if (level.value !== "all" && m.type !== level.value) return false
    if (!term) return true
    const t = `${m.tag || ""} ${m.message || ""}`.toLowerCase()
    return t.includes(term)
  })
})

function fmt(ts?: number) {
  if (!ts) return ""
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <view class="title">Debug messages</view>
        <button size="mini" @click="hc3.clearDebugMessages()">清空</button>
      </view>
      <view style="height: 12rpx" />
      <view class="row" style="justify-content: flex-start; gap: 16rpx; flex-wrap: wrap">
        <button size="mini" :type="level === 'all' ? 'primary' : 'default'" @click="level = 'all'">All</button>
        <button size="mini" :type="level === 'warning' ? 'primary' : 'default'" @click="level = 'warning'">Warning</button>
        <button size="mini" :type="level === 'error' ? 'primary' : 'default'" @click="level = 'error'">Error</button>
      </view>
      <view style="height: 12rpx" />
      <input v-model="q" placeholder="按 tag / message 过滤" />
      <view style="height: 12rpx" />
      <view v-if="rows.length === 0" class="muted">无数据</view>
      <view v-for="m in rows" :key="m.id" class="msg-row">
        <view class="row" style="justify-content: space-between">
          <view>{{ m.type || "-" }} · {{ m.tag || "-" }}</view>
          <view class="muted">{{ fmt(m.timestamp) }}</view>
        </view>
        <view class="muted" style="margin-top: 6rpx; white-space: pre-wrap">{{ m.message }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.msg-row {
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
</style>
