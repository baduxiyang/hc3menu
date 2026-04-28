<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="refresh">刷新</button>
    </view>
    <view class="group" v-for="g in groups" :key="g.key">
      <view class="group-title"><text>{{ g.title }}</text></view>
      <view class="list">
        <view class="item" v-for="s in g.items" :key="s.id" @click="run(s.id)">
          <view class="left">
            <text class="name">{{ s.name || ("Scene " + s.id) }}</text>
            <text class="sub">{{ s.type || "" }}</text>
          </view>
          <text class="run">Run</text>
        </view>
      </view>
    </view>
    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();

const groups = computed(() => {
  const items = (hc3.scenes || []).slice();
  const byRoom: Record<string, any[]> = {};
  for (const s of items) {
    const rid = Number(s?.roomID ?? 0);
    const key = String(rid);
    if (!byRoom[key]) byRoom[key] = [];
    byRoom[key].push(s);
  }
  return Object.keys(byRoom)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => {
      const rid = Number(k);
      return {
        key: k,
        title: hc3.roomName(rid),
        items: byRoom[k].slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))),
      };
    });
});

const refresh = async () => {
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};

const run = (id: number) => {
  hc3.runScene(Number(id)).then(() => uni.showToast({ title: "已执行", icon: "success" })).catch(() => {});
};
</script>

<style scoped lang="scss">
.page {
  height: 100vh;
  background: #f6f7f9;
}
.card.actions {
  margin: 24rpx;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
}
.group {
  margin: 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.group-title {
  padding: 18rpx 24rpx;
  background: #f0f2f6;
  font-size: 26rpx;
  color: #333;
}
.list {
  background: #fff;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520rpx;
}
.sub {
  font-size: 24rpx;
  color: #888;
}
.run {
  font-size: 26rpx;
  color: #007aff;
}
.footer-space {
  height: 60rpx;
}
</style>
