<template>
  <view class="page">
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

    <view class="room-bar" v-if="roomPages.length">
      <view class="room-title" @click="openRoomPicker">
        <text class="room-name">{{ currentPage?.name || "" }}</text>
        <text class="room-caret">▾</text>
      </view>
      <view class="room-meta">
        <text class="room-meta-text">{{ roomIndex + 1 }} / {{ roomPages.length }}</text>
      </view>
    </view>

    <swiper class="swiper" :current="roomIndex" @change="onSwiperChange" v-if="roomPages.length">
      <swiper-item v-for="p in roomPages" :key="p.key">
        <scroll-view scroll-y class="room-scroll">
          <view class="list" v-if="p.devices.length">
            <DeviceRow
              v-for="d in p.devices"
              :key="d.id"
              :device="d"
              :is-favorite="isFavorite(d.id)"
              @open="openDevice"
              @toggle-fav="toggleFav"
            />
          </view>
          <view class="empty" v-else>
            <text>暂无设备</text>
          </view>
          <view class="footer-space"></view>
        </scroll-view>
      </swiper-item>
    </swiper>

    <view class="empty" v-else>
      <text>暂无房间或设备</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import DeviceRow from "@/components/DeviceRow.vue";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const roomIndex = ref(0);

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

type RoomPage = { key: string; name: string; devices: any[] };

const roomPages = computed<RoomPage[]>(() => {
  const roomMap = hc3.rooms || {};
  const devs = Object.values(hc3.devices || {}) as any[];
  const byRoom: Record<number, any[]> = {};
  for (const d of devs) {
    const rid = Number(d?.roomID ?? 0);
    if (!byRoom[rid]) byRoom[rid] = [];
    byRoom[rid].push(d);
  }
  const ids = new Set<number>(Object.keys(roomMap).map((x) => Number(x)));
  for (const k of Object.keys(byRoom)) ids.add(Number(k));
  if (byRoom[0]?.length) ids.add(0);

  const sorted = Array.from(ids).sort((a, b) => {
    const an = a === 0 ? "Unassigned" : (roomMap[a]?.name || "");
    const bn = b === 0 ? "Unassigned" : (roomMap[b]?.name || "");
    return an.localeCompare(bn);
  });

  const pages: RoomPage[] = [];
  if (favoriteDevices.value.length) {
    pages.push({ key: "fav", name: "Favorites", devices: favoriteDevices.value });
  }
  for (const rid of sorted) {
    const name = roomMap[rid]?.name || (rid === 0 ? "Unassigned" : `Room ${rid}`);
    const ds = (byRoom[rid] || []).slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    pages.push({ key: `room:${rid}`, name, devices: ds });
  }
  return pages;
});

const currentPage = computed(() => roomPages.value[roomIndex.value]);

watch(roomPages, (p) => {
  if (!p.length) {
    roomIndex.value = 0;
    return;
  }
  if (roomIndex.value >= p.length) roomIndex.value = 0;
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

const onSwiperChange = (e: any) => {
  const cur = Number(e?.detail?.current ?? 0);
  if (Number.isFinite(cur)) roomIndex.value = cur;
};

const openRoomPicker = () => {
  const items = roomPages.value.map((p) => p.name);
  if (!items.length) return;
  uni.showActionSheet({
    itemList: items,
    success: (res: any) => {
      const idx = Number(res.tapIndex ?? -1);
      if (idx >= 0 && idx < roomPages.value.length) roomIndex.value = idx;
    },
  });
};

onShow(() => {
  if (!settings.loaded) settings.load();
  hc3.startSync().catch(() => {});
});
</script>

<style scoped lang="scss">
.page {
  height: 100vh;
  background: #f6f7f9;
  display: flex;
  flex-direction: column;
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
.room-bar {
  margin: 0 24rpx 12rpx;
  padding: 16rpx 20rpx;
  background: #fff;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.room-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.room-name {
  font-size: 30rpx;
  color: #111;
}
.room-caret {
  font-size: 26rpx;
  color: #666;
}
.room-meta-text {
  font-size: 24rpx;
  color: #999;
}
.swiper {
  flex: 1;
  margin: 0 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: #fff;
}
.room-scroll {
  height: 100%;
}
.list {
  background: #fff;
}
.empty {
  padding: 40rpx 24rpx;
  color: #666;
  text-align: center;
}
.footer-space {
  height: 60rpx;
}
</style>
