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

    <scroll-view scroll-x class="sections" v-if="apiSections.length">
      <view class="sec-item" :class="{ active: idx === sectionIndex }" v-for="(s, idx) in apiSections" :key="s.id" @click="onSectionTap(idx)">
        <text class="sec-text">{{ s.name || ("Section " + s.id) }}</text>
      </view>
    </scroll-view>

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
        <scroll-view
          scroll-y
          scroll-with-animation
          class="room-scroll"
          :scroll-into-view="scrollIntoViewId"
          @scroll="(e: any) => onRoomScroll(p.key, e)"
        >
          <view :id="`top-${p.key}`"></view>
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
import { onHide, onShow, onTabItemTap } from "@dcloudio/uni-app";
import DeviceRow from "@/components/DeviceRow.vue";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const roomIndex = ref(0);
const sectionIndex = ref(0);
const scrollIntoViewId = ref("");
const scrollTopByPage = ref<Record<string, number>>({});
const homeTabText = ref<"Home" | "Back to Top">("Home");

const HOME_TAB_INDEX = 0;

const favoriteSet = computed(() => new Set<number>(settings.config.favorites || []));
const isFavorite = (id: number) => favoriteSet.value.has(Number(id));

type RoomPage = { key: string; name: string; devices: any[] };

const apiSections = computed(() => {
  const items = (hc3.allSections || []).slice();
  items.sort((a: any, b: any) => {
    const sa = Number(a?.sortOrder ?? 0);
    const sb = Number(b?.sortOrder ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
  return items;
});

const selectedSectionId = computed(() => {
  const s = apiSections.value[sectionIndex.value];
  return s?.id != null ? Number(s.id) : null;
});

const roomPages = computed<RoomPage[]>(() => {
  const roomMap = hc3.rooms || {};
  const devs = Object.values(hc3.devices || {}) as any[];
  const byRoom: Record<number, any[]> = {};
  for (const d of devs) {
    const rid = Number(d?.roomID ?? 0);
    if (!byRoom[rid]) byRoom[rid] = [];
    byRoom[rid].push(d);
  }
  const ids = new Set<number>();
  for (const k of Object.keys(roomMap)) {
    const rid = Number(k);
    const r = roomMap[rid];
    const sid = r?.sectionID ?? r?.sectionId ?? r?.section ?? null;
    if (selectedSectionId.value == null || Number(sid) === Number(selectedSectionId.value)) ids.add(rid);
  }
  for (const k of Object.keys(byRoom)) ids.add(Number(k));

  const sorted = Array.from(ids).sort((a, b) => {
    const an = a === 0 ? "Unassigned" : (roomMap[a]?.name || "");
    const bn = b === 0 ? "Unassigned" : (roomMap[b]?.name || "");
    return an.localeCompare(bn);
  });

  const pages: RoomPage[] = [];
  for (const rid of sorted) {
    const r = roomMap[rid];
    const sid = r?.sectionID ?? r?.sectionId ?? r?.section ?? null;
    if (selectedSectionId.value != null && Number(sid) !== Number(selectedSectionId.value)) continue;
    const name = roomMap[rid]?.name || (rid === 0 ? "Unassigned" : `Room ${rid}`);
    const ds = (byRoom[rid] || []).slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    pages.push({ key: `room:${rid}`, name, devices: ds });
  }
  return pages;
});

const currentPage = computed(() => roomPages.value[roomIndex.value]);
const currentPageKey = computed(() => currentPage.value?.key || "");

watch(roomPages, (p) => {
  if (!p.length) {
    roomIndex.value = 0;
    return;
  }
  if (roomIndex.value >= p.length) roomIndex.value = 0;
});

watch(apiSections, (p) => {
  if (!p.length) {
    sectionIndex.value = 0;
    return;
  }
  if (sectionIndex.value >= p.length) sectionIndex.value = 0;
});

const setHomeTab = (text: "Home" | "Back to Top") => {
  if (homeTabText.value === text) return;
  homeTabText.value = text;
  uni.setTabBarItem({ index: HOME_TAB_INDEX, text }).catch(() => {});
};

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
  const key = roomPages.value[cur]?.key || "";
  const top = scrollTopByPage.value[key] || 0;
  setHomeTab(top > 8 ? "Back to Top" : "Home");
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

const onSectionTap = (idx: number) => {
  sectionIndex.value = Number(idx) || 0;
  roomIndex.value = 0;
  setHomeTab("Home");
};

const onRoomScroll = (key: string, e: any) => {
  const top = Number(e?.detail?.scrollTop ?? 0);
  scrollTopByPage.value = { ...scrollTopByPage.value, [key]: Number.isFinite(top) ? top : 0 };
  if (key === currentPageKey.value) setHomeTab(top > 8 ? "Back to Top" : "Home");
};

const backToTop = () => {
  const key = currentPageKey.value;
  if (!key) return;
  scrollIntoViewId.value = `top-${key}`;
  scrollTopByPage.value = { ...scrollTopByPage.value, [key]: 0 };
  setHomeTab("Home");
  setTimeout(() => {
    scrollIntoViewId.value = "";
  }, 80);
};

onTabItemTap((e) => {
  if (Number(e.index) !== HOME_TAB_INDEX) return;
  if (homeTabText.value === "Back to Top") backToTop();
});

onShow(() => {
  if (!settings.loaded) settings.load();
  hc3.startSync().catch(() => {});
  const key = currentPageKey.value;
  const top = scrollTopByPage.value[key] || 0;
  setHomeTab(top > 8 ? "Back to Top" : "Home");
});

onHide(() => {
  setHomeTab("Home");
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
.sections {
  white-space: nowrap;
  margin: 0 24rpx 12rpx;
}
.sec-item {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 14rpx 18rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  background: #fff;
}
.sec-item.active {
  background: #e8f1ff;
}
.sec-text {
  font-size: 24rpx;
  color: #111;
}
.sec-badge {
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #ef4444;
  color: #fff;
  font-size: 22rpx;
  line-height: 34rpx;
  text-align: center;
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
