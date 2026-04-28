<template>
  <scroll-view scroll-y class="page">
    <view class="card">
      <view class="row">
        <text class="label">连接状态</text>
        <text class="value">{{ hc3.connected ? "Connected" : "Disconnected" }}</text>
      </view>
      <view class="row" v-if="!hc3.connected && hc3.lastError">
        <text class="label">错误</text>
        <text class="value">{{ hc3.lastError }}</text>
      </view>
      <view class="actions">
        <button size="mini" @click="onRefresh">刷新</button>
        <button size="mini" @click="openSettings">设置</button>
      </view>
    </view>

    <view class="menu">
      <view class="item" @click="open('/pages/search/index')"><text>Search</text></view>
      <view class="item" @click="open('/pages/favorites/index')"><text>Favorites</text></view>
      <view class="item" @click="open('/pages/notifications/index')"><text>Notifications</text></view>
      <view class="item" @click="open('/pages/scenes/index')"><text>Scenes</text></view>
      <view class="item" @click="open('/pages/alarm/index')"><text>Alarm</text></view>
      <view class="item" @click="open('/pages/profiles/index')"><text>Profiles</text></view>
      <view class="item" @click="open('/pages/attention/index')"><text>Attention</text></view>
      <view class="item" @click="open('/pages/activity/index')"><text>Activity</text></view>
      <view class="item" @click="open('/pages/debug/index')"><text>Debug messages</text></view>
      <view class="item" @click="open('/pages/diagnostics/index')"><text>Diagnostics</text></view>
      <view class="item" @click="open('/pages/settings/index')"><text>设置</text></view>
    </view>
    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const open = (url: string) => {
  uni.navigateTo({ url });
};

const onRefresh = async () => {
  if (!settings.isCredsComplete) {
    uni.showToast({ title: "请先去设置填写连接信息", icon: "none" });
    return;
  }
  await hc3.refreshNow().catch((e: any) => uni.showToast({ title: e?.message || "刷新失败", icon: "none" }));
};

const openSettings = () => open("/pages/settings/index");
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
.row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  gap: 20rpx;
}
.label {
  font-size: 26rpx;
  color: #333;
}
.value {
  font-size: 26rpx;
  color: #666;
  text-align: right;
}
.actions {
  margin-top: 16rpx;
  display: flex;
  gap: 16rpx;
}
.menu {
  margin: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.item {
  padding: 26rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  font-size: 30rpx;
  color: #111;
}
.item:last-child {
  border-bottom: 0;
}
.footer-space {
  height: 60rpx;
}
</style>
