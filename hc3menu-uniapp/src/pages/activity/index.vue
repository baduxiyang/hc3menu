<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="refresh">刷新</button>
    </view>

    <view class="list card" v-if="items.length">
      <view class="item" v-for="a in items" :key="a.ts">
        <view class="left">
          <text class="name">{{ a.text }}</text>
          <text class="sub">{{ fmt(a.ts) }} · {{ a.kind }}</text>
        </view>
        <button v-if="a.devId" size="mini" @click="openDevice(a.devId)">设备</button>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>暂无 Activity</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();

const items = computed(() => hc3.recentActivity(50));

const fmt = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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
  gap: 16rpx;
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
  font-size: 28rpx;
  color: #111;
}
.sub {
  font-size: 22rpx;
  color: #888;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>
