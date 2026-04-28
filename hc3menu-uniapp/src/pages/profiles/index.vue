<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <text class="active">Active: {{ activeName }}</text>
      <button size="mini" @click="refresh">刷新</button>
    </view>

    <view class="list card" v-if="profiles.length">
      <view class="item" v-for="p in profiles" :key="p.id" @click="setActive(p.id)">
        <view class="left">
          <text class="name">{{ p.name || ("Profile " + p.id) }}</text>
        </view>
        <text class="mark">{{ Number(p.id) === Number(hc3.activeProfileId) ? "✅" : "" }}</text>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>没有 Profiles 或未同步</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();

const profiles = computed(() => (hc3.profiles || []).slice().sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0)));
const activeName = computed(() => {
  const id = hc3.activeProfileId;
  const p = profiles.value.find((x: any) => Number(x?.id) === Number(id));
  return p?.name || (id != null ? String(id) : "-");
});

const refresh = async () => {
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};

const setActive = (id: number) => {
  hc3.setActiveProfile(Number(id)).then(() => uni.showToast({ title: "已切换", icon: "success" })).catch(() => {});
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
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
}
.active {
  font-size: 26rpx;
  color: #333;
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
.name {
  font-size: 30rpx;
  color: #111;
}
.mark {
  font-size: 28rpx;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>
