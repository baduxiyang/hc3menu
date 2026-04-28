<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="refresh">刷新</button>
    </view>

    <view class="card" v-if="hasData">
      <view class="row">
        <text class="label">CPU avg</text>
        <text class="value">{{ cpuAvgText }}</text>
      </view>
      <view class="row col" v-if="hc3.cpuPcts.length">
        <text class="label">CPU cores</text>
        <view class="chips">
          <text class="chip" v-for="(p,i) in hc3.cpuPcts" :key="i">CPU{{ i }} {{ p.toFixed(0) }}%</text>
        </view>
      </view>
      <view class="row" v-if="memUsed != null">
        <text class="label">RAM used</text>
        <text class="value">{{ memUsed }}%</text>
      </view>
      <view class="row" v-if="maxDiskUsed != null">
        <text class="label">Disk max used</text>
        <text class="value">{{ maxDiskUsed.toFixed(0) }}%</text>
      </view>
    </view>

    <view class="card" v-if="mem">
      <view class="title"><text>Memory</text></view>
      <view class="row" v-for="k in ['used','free','cache','buffers']" :key="k">
        <text class="label">{{ k }}</text>
        <text class="value">{{ mem[k] != null ? String(mem[k]) + '%' : '-' }}</text>
      </view>
    </view>

    <view class="card" v-if="storageInternal.length">
      <view class="title"><text>Storage</text></view>
      <view class="row" v-for="s in storageInternal" :key="s.name">
        <text class="label">{{ s.name || '?' }}</text>
        <text class="value">{{ s.used != null ? Number(s.used).toFixed(1) + '%' : '-' }}</text>
      </view>
    </view>

    <view class="card empty" v-if="!hasData">
      <text>暂无 Diagnostics</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();

const diag = computed(() => hc3.diagnostics || {});
const mem = computed<any>(() => (diag.value?.memory && typeof diag.value.memory === "object") ? diag.value.memory : null);
const storageInternal = computed<any[]>(() => {
  const s = diag.value?.storage?.internal;
  return Array.isArray(s) ? s : [];
});

const memUsed = computed<number | null>(() => {
  const v = mem.value?.used;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
});

const cpuAvgText = computed(() => {
  if (!hc3.cpuPcts.length) return "-";
  const avg = hc3.cpuPcts.reduce((a, b) => a + b, 0) / hc3.cpuPcts.length;
  return `${avg.toFixed(0)}%`;
});

const maxDiskUsed = computed<number | null>(() => {
  const arr = storageInternal.value;
  if (!arr.length) return null;
  const values = arr.map((x) => Number(x?.used ?? 0)).filter((x) => Number.isFinite(x));
  if (!values.length) return null;
  return Math.max(...values);
});

const hasData = computed(() => Object.keys(diag.value || {}).length > 0);

const refresh = async () => {
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};
</script>

<style scoped lang="scss">
.page {
  height: 100vh;
  background: #f6f7f9;
}
.card {
  margin: 24rpx;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
}
.actions {
  display: flex;
  gap: 16rpx;
}
.title {
  font-size: 30rpx;
  color: #111;
  margin-bottom: 12rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20rpx;
  padding: 12rpx 0;
}
.row.col {
  flex-direction: column;
  align-items: stretch;
}
.label {
  font-size: 26rpx;
  color: #333;
}
.value {
  font-size: 26rpx;
  color: #666;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.chip {
  font-size: 22rpx;
  color: #333;
  padding: 10rpx 14rpx;
  border-radius: 999rpx;
  background: #f0f2f6;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>
