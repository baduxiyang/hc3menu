<script setup lang="ts">
import { computed } from "vue"
import { onPullDownRefresh } from "@dcloudio/uni-app"
import { useHc3Store } from "../../stores/hc3"

const hc3 = useHc3Store()
const scenes = computed(() => hc3.scenes || [])

async function refresh() {
  await hc3.refreshNow()
  uni.stopPullDownRefresh()
}

async function run(id: number) {
  try {
    await hc3.runScene(id)
    uni.showToast({ title: "已执行", icon: "none" })
  } catch (e: any) {
    uni.showToast({ title: e?.message || "失败", icon: "none" })
  }
}

onPullDownRefresh(refresh)
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <view class="title">场景</view>
        <button size="mini" @click="refresh">刷新</button>
      </view>
      <view v-if="scenes.length === 0" class="muted">无场景</view>
      <view v-for="s in scenes" :key="s.id" class="scene-row">
        <view>
          <view>{{ s.name || ("Scene " + s.id) }}</view>
          <view class="muted">id={{ s.id }} · roomID={{ s.roomID == null ? "-" : s.roomID }}</view>
        </view>
        <button size="mini" type="primary" @click="run(Number(s.id))">运行</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.scene-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
</style>
