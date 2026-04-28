<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="refresh">刷新</button>
    </view>

    <view class="list card" v-if="items.length">
      <view class="item" v-for="(d, idx) in items" :key="d.id">
        <view class="left" @click="openDevice(d.id)">
          <text class="name">{{ d.name || ("Device " + d.id) }}</text>
          <text class="sub">{{ d.type || d.baseType || '' }}</text>
        </view>
        <view class="right">
          <button size="mini" @click="moveUp(idx)" :disabled="idx === 0">↑</button>
          <button size="mini" @click="moveDown(idx)" :disabled="idx === items.length - 1">↓</button>
          <button size="mini" @click="remove(d.id)">Remove</button>
        </view>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>暂无 Favorites</text>
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
  const ids = settings.config.favorites || [];
  const out: any[] = [];
  for (const id of ids) {
    const d = hc3.devices?.[Number(id)];
    if (d) out.push(d);
  }
  return out;
});

const persistOrder = (ids: number[]) => {
  settings.setFavoritesOrder(ids);
};

const moveUp = (idx: number) => {
  const ids = (settings.config.favorites || []).slice();
  if (idx <= 0 || idx >= ids.length) return;
  const t = ids[idx - 1];
  ids[idx - 1] = ids[idx];
  ids[idx] = t;
  persistOrder(ids);
};

const moveDown = (idx: number) => {
  const ids = (settings.config.favorites || []).slice();
  if (idx < 0 || idx >= ids.length - 1) return;
  const t = ids[idx + 1];
  ids[idx + 1] = ids[idx];
  ids[idx] = t;
  persistOrder(ids);
};

const remove = (id: number) => {
  settings.toggleFavorite(Number(id));
};

const openDevice = (id: number) => {
  uni.navigateTo({ url: `/pages/device/index?id=${Number(id)}` });
};

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
.right {
  display: flex;
  gap: 10rpx;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>

