<template>
  <scroll-view scroll-y class="page">
    <view class="card">
      <view class="status">
        <text class="dot" :class="{ ok: hc3.connected, bad: !hc3.connected }"></text>
        <text class="status-text">{{ hc3.connected ? "Connected" : (hc3.lastError || "Disconnected") }}</text>
      </view>
      <view class="actions">
        <button size="mini" @click="onRefresh">刷新</button>
        <button size="mini" @click="goSearch">搜索</button>
        <button size="mini" @click="goSettings">设置</button>
        <button size="mini" @click="goMore">更多</button>
      </view>
    </view>

    <view class="section" v-if="favoriteDevices.length">
      <view class="section-title">
        <text>Favorites</text>
      </view>
      <view class="list">
        <DeviceRow
          v-for="d in favoriteDevices"
          :key="d.id"
          :device="d"
          :is-favorite="true"
          @open="openDevice"
          @toggle-fav="toggleFav"
        />
      </view>
    </view>

    <view class="section" v-for="room in rooms" :key="room.id">
      <view class="section-title">
        <text>{{ room.name || "Unassigned" }}</text>
      </view>
      <view class="list">
        <DeviceRow
          v-for="d in room.devices"
          :key="d.id"
          :device="d"
          :is-favorite="isFavorite(d.id)"
          @open="openDevice"
          @toggle-fav="toggleFav"
        />
      </view>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import DeviceRow from "@/components/DeviceRow.vue";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const favoriteSet = computed(() => new Set<number>(settings.config.favorites || []));
const isFavorite = (id: number) => favoriteSet.value.has(Number(id));

const favoriteDevices = computed(() => {
  const ids = settings.config.favorites || [];
  const out: any[] = [];
  for (const id of ids) {
    const d = hc3.devices?.[Number(id)];
    if (d) out.push(d);
  }
  return out;
});

const rooms = computed(() => {
  const roomMap = hc3.rooms || {};
  const devs = Object.values(hc3.devices || {}) as any[];
  const byRoom: Record<number, any[]> = {};
  for (const d of devs) {
    const rid = Number(d?.roomID ?? 0);
    if (!byRoom[rid]) byRoom[rid] = [];
    byRoom[rid].push(d);
  }
  const out = Object.keys(byRoom)
    .map((k) => Number(k))
    .sort((a, b) => {
      const an = roomMap[a]?.name || "";
      const bn = roomMap[b]?.name || "";
      return an.localeCompare(bn);
    })
    .map((rid) => ({
      id: rid,
      name: roomMap[rid]?.name || (rid === 0 ? "Unassigned" : `Room ${rid}`),
      devices: byRoom[rid].slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))),
    }));
  return out;
});

const openDevice = (id: number) => {
  uni.navigateTo({ url: `/pages/device/index?id=${Number(id)}` });
};

const toggleFav = (id: number) => {
  settings.toggleFavorite(Number(id));
};

const onRefresh = async () => {
  if (!settings.isCredsComplete) {
    uni.showToast({ title: "请先去设置填写连接信息", icon: "none" });
    return;
  }
  await hc3.refreshNow().catch((e: any) => {
    uni.showToast({ title: e?.message || "刷新失败", icon: "none" });
  });
};

const goSettings = () => uni.navigateTo({ url: "/pages/settings/index" });
const goMore = () => uni.switchTab({ url: "/pages/more/index" });
const goSearch = () => uni.navigateTo({ url: "/pages/search/index" });

onPullDownRefresh(() => {
  onRefresh().finally(() => uni.stopPullDownRefresh());
});

onShow(() => {
  if (!settings.loaded) settings.load();
  hc3.startSync().catch(() => {});
});
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
.status {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #bbb;
}
.dot.ok {
  background: #22c55e;
}
.dot.bad {
  background: #ef4444;
}
.status-text {
  font-size: 26rpx;
  color: #333;
}
.actions {
  margin-top: 16rpx;
  display: flex;
  gap: 16rpx;
}
.section {
  margin: 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.section-title {
  padding: 18rpx 24rpx;
  background: #f0f2f6;
  font-size: 26rpx;
  color: #333;
}
.list {
  background: #fff;
}
.footer-space {
  height: 60rpx;
}
</style>
