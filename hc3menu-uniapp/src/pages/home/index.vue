<template>
  <view class="page">
    <scroll-view scroll-x class="sections" v-if="displaySections.length">
      <view
        class="sec-item"
        :class="{ active: idx === sectionIndex }"
        v-for="(s, idx) in displaySections"
        :key="s.key"
        @click="onSectionTap(idx)"
      >
        <text class="sec-text">{{ s.name }}</text>
      </view>
    </scroll-view>

    <view class="room-bar" v-if="roomPages.length">
      <view class="room-title" @click="openRoomPicker">
        <text class="room-name">{{ displayRoom?.name || "" }}</text>
        <text class="room-caret">▾</text>
      </view>
      <view class="room-meta">
        <text class="room-meta-text">{{ displayRoomIndex + 1 }} / {{ roomPages.length }}</text>
      </view>
    </view>

    <swiper class="swiper" :current="swiperCurrent" :disable-touch="swiperDisableTouch" @animationfinish="onSwiperFinish">
      <swiper-item v-for="v in virtualPages" :key="v.slot">
        <scroll-view
          v-if="v.page"
          :key="`${v.slot}:${v.page.key}:${scrollViewKeyByPage[v.page.key] || 0}`"
          scroll-y
          class="room-scroll"
          :scroll-top="scrollTopCmdByPage[v.page.key]"
          refresher-enabled
          :refresher-triggered="refresherTriggered && refresherKey === v.page.key"
          @refresherrefresh="() => onRefresherRefresh(v.page!.key)"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
          @scroll="(e: any) => onRoomScroll(v.page!.key, e)"
        >
          <view class="list" v-if="v.page.devices.length">
            <DeviceRow
              v-for="d in v.page.devices"
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
        <view v-else class="empty full">
          <text>暂无房间或设备</text>
        </view>
      </swiper-item>
    </swiper>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onHide, onNavigationBarButtonTap, onShow, onTabItemTap } from "@dcloudio/uni-app";
import DeviceRow from "@/components/DeviceRow.vue";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const roomIndex = ref(0);
const sectionIndex = ref(0);
const swiperCurrent = ref(1);
const swiperResetting = ref(false);
const displayRoomKey = ref("");
const scrollTopByPage = ref<Record<string, number>>({});
const scrollTopCmdByPage = ref<Record<string, number | undefined>>({});
const scrollViewKeyByPage = ref<Record<string, number | undefined>>({});
const homeTabText = ref<"Home" | "Back to Top">("Home");
const refresherTriggered = ref(false);
const refresherKey = ref("");

const HOME_TAB_INDEX = 0;

const favoriteSet = computed(() => new Set<number>(settings.config.favorites || []));
const isFavorite = (id: number) => favoriteSet.value.has(Number(id));

type RoomPage = { key: string; name: string; devices: any[] };

const apiSections = computed<any[]>(() => {
  const items = (hc3.allSections || []).slice();
  items.sort((a: any, b: any) => {
    const sa = Number(a?.sortOrder ?? 0);
    const sb = Number(b?.sortOrder ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
  return items;
});

const displaySections = computed(() => {
  const out: { key: string; id: number | null; name: string }[] = [];
  out.push({ key: "all", id: null, name: "All" });
  for (const s of apiSections.value) {
    const id = s?.id != null ? Number(s.id) : null;
    out.push({ key: `sec:${id ?? "x"}`, id, name: String(s?.name || `Section ${id ?? ""}`).trim() || "Section" });
  }
  return out;
});

const selectedSectionId = computed(() => {
  const s = displaySections.value[sectionIndex.value];
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

const swiperDisableTouch = computed(() => roomPages.value.length <= 1);

const currentPage = computed(() => roomPages.value[roomIndex.value]);
const currentPageKey = computed(() => currentPage.value?.key || "");
const displayRoom = computed(() => {
  const k = displayRoomKey.value;
  if (k) {
    const found = roomPages.value.find((p) => p.key === k);
    if (found) return found;
  }
  return currentPage.value;
});
const displayRoomIndex = computed(() => {
  const k = displayRoom.value?.key;
  if (!k) return 0;
  const idx = roomPages.value.findIndex((p) => p.key === k);
  return idx >= 0 ? idx : 0;
});

const virtualPages = computed(() => {
  const src = roomPages.value;
  const len = src.length;
  if (!len) return [{ slot: "prev", page: null }, { slot: "cur", page: null }, { slot: "next", page: null }];
  if (len === 1) return [{ slot: "prev", page: src[0] }, { slot: "cur", page: src[0] }, { slot: "next", page: src[0] }];
  if (len === 2) {
    const idx = roomIndex.value === 1 ? 1 : 0;
    const other = idx === 0 ? 1 : 0;
    return [{ slot: "prev", page: src[other] }, { slot: "cur", page: src[idx] }, { slot: "next", page: src[other] }];
  }
  const idx = Math.max(0, Math.min(len - 1, roomIndex.value));
  const prev = src[Math.max(0, idx - 1)];
  const cur = src[idx];
  const next = src[Math.min(len - 1, idx + 1)];
  return [{ slot: "prev", page: prev }, { slot: "cur", page: cur }, { slot: "next", page: next }];
});

let backToTopTimer1: number | null = null;
let backToTopTimer2: number | null = null;

const clearBackToTopTimers = () => {
  if (backToTopTimer1 != null) {
    clearTimeout(backToTopTimer1);
    backToTopTimer1 = null;
  }
  if (backToTopTimer2 != null) {
    clearTimeout(backToTopTimer2);
    backToTopTimer2 = null;
  }
};

watch(roomPages, (p) => {
  if (!p.length) {
    roomIndex.value = 0;
    swiperCurrent.value = 1;
    displayRoomKey.value = "";
    return;
  }
  if (roomIndex.value >= p.length) roomIndex.value = 0;
  swiperCurrent.value = 1;

  if (!displayRoomKey.value || !p.some((x) => x.key === displayRoomKey.value)) {
    displayRoomKey.value = p[roomIndex.value]?.key || p[0]?.key || "";
  } else {
    const idx = p.findIndex((x) => x.key === displayRoomKey.value);
    if (idx >= 0) roomIndex.value = idx;
  }

  const keys = new Set(p.map((x) => x.key));
  const keepNum = (src: Record<string, number>) => {
    const out: Record<string, number> = {};
    for (const k of Object.keys(src)) if (keys.has(k)) out[k] = src[k];
    return out;
  };
  const keepAny = (src: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(src)) if (keys.has(k)) out[k] = src[k];
    return out;
  };
  scrollTopByPage.value = keepNum(scrollTopByPage.value);
  scrollTopCmdByPage.value = keepAny(scrollTopCmdByPage.value);
  scrollViewKeyByPage.value = keepAny(scrollViewKeyByPage.value);
});

watch(displaySections, (p) => {
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

const doRefresh = async () => {
  if (!settings.isCredsComplete) {
    uni.showToast({ title: "请先去设置填写连接信息", icon: "none" });
    return;
  }
  await hc3.refreshNow().catch((e: any) => {
    uni.showToast({ title: e?.message || "刷新失败", icon: "none" });
  });
};

const goSearch = () => uni.navigateTo({ url: "/pages/search/index" });

onNavigationBarButtonTap((e) => {
  if (Number(e.index) === 0) goSearch();
});

const onRefresherRefresh = async (key: string) => {
  if (refresherTriggered.value) return;
  if (key !== currentPageKey.value) return;
  const top = Number(scrollTopByPage.value[key] ?? 0);
  if (top > 2) return;
  refresherKey.value = key;
  refresherTriggered.value = true;
  try {
    await doRefresh();
  } finally {
    refresherTriggered.value = false;
    refresherKey.value = "";
  }
};

const onRefresherRestore = () => {
  refresherTriggered.value = false;
  refresherKey.value = "";
};

const resetSwiperToCenter = () => {
  if (swiperResetting.value) return;
  swiperResetting.value = true;
  nextTick(() => {
    swiperCurrent.value = 1;
    setTimeout(() => {
      swiperResetting.value = false;
    }, 80);
  });
};

const onSwiperFinish = (e: any) => {
  if (swiperResetting.value) return;
  if (swiperDisableTouch.value) {
    roomIndex.value = 0;
    swiperCurrent.value = 1;
    displayRoomKey.value = roomPages.value[0]?.key || "";
    setHomeTab("Home");
    return;
  }

  const cur = Number(e?.detail?.current ?? 1);
  if (cur === 1) return;

  const len = roomPages.value.length;
  let next = roomIndex.value;
  if (len === 2) {
    next = next === 0 ? 1 : 0;
  } else {
    if (cur === 0) next = Math.max(0, next - 1);
    if (cur === 2) next = Math.min(len - 1, next + 1);
  }

  roomIndex.value = next;
  const key = roomPages.value[next]?.key || "";
  displayRoomKey.value = key;
  const top = scrollTopByPage.value[key] || 0;
  setHomeTab(top > 8 ? "Back to Top" : "Home");
  resetSwiperToCenter();
};

const openRoomPicker = () => {
  const items = roomPages.value.map((p) => p.name);
  if (!items.length) return;
  uni.showActionSheet({
    itemList: items,
    success: (res: any) => {
      const idx = Number(res.tapIndex ?? -1);
      if (idx >= 0 && idx < roomPages.value.length) {
        roomIndex.value = idx;
        swiperCurrent.value = 1;
        displayRoomKey.value = roomPages.value[idx]?.key || "";
      }
    },
  });
};

const onSectionTap = (idx: number) => {
  clearBackToTopTimers();
  sectionIndex.value = Number(idx) || 0;
  roomIndex.value = 0;
  swiperCurrent.value = 1;
  scrollTopCmdByPage.value = {};
  scrollTopByPage.value = {};
  scrollViewKeyByPage.value = {};
  refresherTriggered.value = false;
  refresherKey.value = "";
  displayRoomKey.value = roomPages.value[0]?.key || "";
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
  clearBackToTopTimers();
  scrollTopCmdByPage.value = { ...scrollTopCmdByPage.value, [key]: 1 };
  scrollTopByPage.value = { ...scrollTopByPage.value, [key]: 0 };
  setHomeTab("Home");
  backToTopTimer1 = setTimeout(() => {
    if (!roomPages.value.some((p) => p.key === key)) return;
    scrollTopCmdByPage.value = { ...scrollTopCmdByPage.value, [key]: 0 };
    const cur = Number(scrollViewKeyByPage.value[key] ?? 0);
    scrollViewKeyByPage.value = { ...scrollViewKeyByPage.value, [key]: cur + 1 };
  }, 30) as unknown as number;

  backToTopTimer2 = setTimeout(() => {
    const nextTop = { ...scrollTopCmdByPage.value };
    delete nextTop[key];
    scrollTopCmdByPage.value = nextTop;
  }, 160) as unknown as number;
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
.empty.full {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.footer-space {
  height: 60rpx;
}
</style>
