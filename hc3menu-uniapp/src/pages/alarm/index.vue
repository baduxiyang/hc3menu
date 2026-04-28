<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="hc3.armAll">Arm all</button>
      <button size="mini" @click="hc3.disarmAll">Disarm all</button>
      <button size="mini" @click="refresh">刷新</button>
    </view>

    <view class="list card" v-if="parts.length">
      <view class="item" v-for="p in parts" :key="p.id">
        <view class="left">
          <text class="name">{{ p.name || ("Partition " + p.id) }}</text>
          <text class="sub">{{ statusText(p) }}</text>
        </view>
        <view class="right">
          <button v-if="!p.armed" size="mini" @click="arm(p.id)">Arm</button>
          <button v-else size="mini" @click="disarm(p.id)">Disarm</button>
        </view>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>没有分区或未同步</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();

const parts = computed(() => (hc3.allPartitions || []).slice().sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0)));

const statusText = (p: any) => {
  if (p?.breached) return "Breached";
  if (p?.pending) return "Pending";
  return p?.armed ? "Armed" : "Disarmed";
};

const refresh = async () => {
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};

const arm = (id: number) => {
  hc3.armPartition(Number(id)).then(() => uni.showToast({ title: "已 Arm", icon: "success" })).catch(() => {});
};

const disarm = (id: number) => {
  hc3.disarmPartition(Number(id)).then(() => uni.showToast({ title: "已 Disarm", icon: "success" })).catch(() => {});
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
  flex-wrap: wrap;
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
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>
