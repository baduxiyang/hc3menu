<template>
  <scroll-view scroll-y class="page">
    <view class="card actions">
      <button size="mini" @click="refresh">刷新</button>
      <button size="mini" @click="clear">清空</button>
    </view>

    <view class="list card" v-if="items.length">
      <view class="item" v-for="m in items" :key="m.id" @click="copyTag(m)">
        <view class="left">
          <text class="name">{{ m.type }} · {{ m.tag || "" }}</text>
          <text class="sub">{{ String(m.message || "") }}</text>
        </view>
        <text class="id">#{{ m.id }}</text>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>暂无 Debug messages</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();
const items = computed(() => hc3.recentDebugMessages(200));

const refresh = async () => {
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};

const clear = () => {
  hc3.debugMsgs = [];
  hc3.debugSeenIds = {};
};

const copyTag = (m: any) => {
  const text = String(m?.tag || m?.id || "");
  if (!text) return;
  uni.setClipboardData({ data: text, success: () => uni.showToast({ title: "已复制", icon: "success" }) });
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
  font-size: 26rpx;
  color: #111;
}
.sub {
  font-size: 22rpx;
  color: #666;
}
.id {
  font-size: 22rpx;
  color: #999;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>
