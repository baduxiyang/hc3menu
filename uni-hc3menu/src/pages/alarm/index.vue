<script setup lang="ts">
import { computed } from "vue"
import { onPullDownRefresh } from "@dcloudio/uni-app"
import { useHc3Store } from "../../stores/hc3"

const hc3 = useHc3Store()
const parts = computed(() => Object.values(hc3.partitions || {}))

async function refresh() {
  await hc3.refreshNow()
  uni.stopPullDownRefresh()
}

async function arm(id: number) {
  try {
    await hc3.armPartition(id)
    uni.showToast({ title: "已布防", icon: "none" })
  } catch (e: any) {
    uni.showToast({ title: e?.message || "失败", icon: "none" })
  }
}

async function disarm(id: number) {
  try {
    await hc3.disarmPartition(id)
    uni.showToast({ title: "已撤防", icon: "none" })
  } catch (e: any) {
    uni.showToast({ title: e?.message || "失败", icon: "none" })
  }
}

async function armAll() {
  try {
    await hc3.armAll()
    uni.showToast({ title: "已布防全部", icon: "none" })
  } catch (e: any) {
    uni.showToast({ title: e?.message || "失败", icon: "none" })
  }
}

async function disarmAll() {
  try {
    await hc3.disarmAll()
    uni.showToast({ title: "已撤防全部", icon: "none" })
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
        <view class="title">报警分区</view>
        <view class="row" style="justify-content: flex-end; gap: 16rpx">
          <button size="mini" type="primary" @click="armAll">全部布防</button>
          <button size="mini" @click="disarmAll">全部撤防</button>
        </view>
      </view>
      <view style="height: 12rpx" />
      <view v-if="parts.length === 0" class="muted">无分区</view>
      <view v-for="p in parts" :key="p.id" class="part-row">
        <view>
          <view>{{ p.name || ("Partition " + p.id) }}</view>
          <view class="muted">armed={{ Boolean(p.armed) }} · breached={{ Boolean(p.breached) }}</view>
        </view>
        <view class="row" style="justify-content: flex-end; gap: 12rpx">
          <button size="mini" type="primary" @click="arm(Number(p.id))">布防</button>
          <button size="mini" @click="disarm(Number(p.id))">撤防</button>
        </view>
      </view>
      <button style="margin-top: 12rpx" @click="refresh">刷新</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.part-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
</style>

