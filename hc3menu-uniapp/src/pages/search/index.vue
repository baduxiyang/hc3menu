<template>
  <scroll-view scroll-y class="page">
    <view class="card">
      <view class="field">
        <input class="input" v-model="q" placeholder="搜索设备/场景" />
        <button size="mini" @click="refresh">刷新</button>
      </view>
    </view>

    <view class="card list" v-if="results.length">
      <view class="item" v-for="r in results" :key="r.key" @click="onSelect(r)">
        <view class="left">
          <text class="name">{{ r.name }}</text>
          <text class="sub">{{ r.sub }}</text>
        </view>
        <text class="tag">{{ r.kind }}</text>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>{{ q.trim() ? "无匹配结果" : "输入关键词开始搜索" }}</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useHc3Store } from "@/stores/hc3";

const hc3 = useHc3Store();
const q = ref("");

type ResultItem =
  | { kind: "device"; key: string; id: number; name: string; sub: string }
  | { kind: "scene"; key: string; id: number; name: string; sub: string };

const norm = (s: string) => (s || "").trim().toLowerCase();

const results = computed<ResultItem[]>(() => {
  const kw = norm(q.value);
  if (!kw) return [];

  const out: ResultItem[] = [];
  for (const d of Object.values(hc3.devices || {}) as any[]) {
    const name = String(d?.name || "");
    if (!norm(name).includes(kw)) continue;
    const rid = Number(d?.roomID ?? 0);
    out.push({
      kind: "device",
      key: `d:${d.id}`,
      id: Number(d.id),
      name: name || `Device ${d.id}`,
      sub: `${hc3.roomName(rid)} · ${d.type || d.baseType || ""}`,
    });
  }
  for (const s of (hc3.scenes || []) as any[]) {
    const name = String(s?.name || "");
    if (!norm(name).includes(kw)) continue;
    const rid = Number(s?.roomID ?? 0);
    out.push({
      kind: "scene",
      key: `s:${s.id}`,
      id: Number(s.id),
      name: name || `Scene ${s.id}`,
      sub: `${hc3.roomName(rid)} · ${s.type || ""}`,
    });
  }
  return out.slice(0, 100);
});

const onSelect = (r: ResultItem) => {
  if (r.kind === "device") {
    uni.navigateTo({ url: `/pages/device/index?id=${Number(r.id)}` });
    return;
  }
  hc3.runScene(Number(r.id)).then(() => uni.showToast({ title: "已执行", icon: "success" })).catch(() => {});
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
.field {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.input {
  flex: 1;
  font-size: 28rpx;
  color: #111;
  padding: 12rpx 0;
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
.tag {
  font-size: 22rpx;
  color: #007aff;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>

