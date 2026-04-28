<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="refresh">刷新</button>
    </view>

    <view class="list card" v-if="items.length">
      <view class="item" v-for="d in items" :key="d.id" @click="openDevice(d.id)">
        <view class="left">
          <text class="name">{{ d.name || ("Device " + d.id) }}</text>
          <text class="sub">{{ reason(d) }}</text>
        </view>
        <text class="go">></text>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>暂无 Attention</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const items = computed(() => {
  const thr = Number(settings.config.lowBatteryThreshold ?? 20);
  const devs = Object.values(hc3.devices || {}) as any[];
  return devs
    .filter((d) => {
      const p = d?.properties || {};
      const dead = Boolean(p.dead);
      const batt = p.batteryLevel;
      const battNum = batt != null ? Number(batt) : null;
      const lowBatt = battNum != null && Number.isFinite(battNum) && battNum <= thr;
      return dead || lowBatt;
    })
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
});

const reason = (d: any) => {
  const thr = Number(settings.config.lowBatteryThreshold ?? 20);
  const p = d?.properties || {};
  if (p.dead) return "dead";
  if (p.batteryLevel != null) return `battery ${p.batteryLevel}% (<=${thr}%)`;
  return "";
};

const refresh = async () => {
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};

const openDevice = (id: number) => {
  uni.navigateTo({ url: `/pages/device/index?id=${Number(id)}` });
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
.list {
  padding: 0;
  overflow: hidden;
}
.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.item:last-child {
  border-bottom: 0;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.name {
  font-size: 30rpx;
  color: #111;
}
.sub {
  font-size: 24rpx;
  color: #888;
}
.go {
  color: #bbb;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>
