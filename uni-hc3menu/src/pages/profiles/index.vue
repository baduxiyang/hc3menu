<script setup lang="ts">
import { computed } from "vue"
import { onPullDownRefresh } from "@dcloudio/uni-app"
import { useHc3Store } from "../../stores/hc3"

const hc3 = useHc3Store()
const profiles = computed(() => hc3.profiles || [])

async function refresh() {
  await hc3.refreshNow()
  uni.stopPullDownRefresh()
}

async function activate(id: number) {
  try {
    await hc3.setActiveProfile(id)
    uni.showToast({ title: "已切换", icon: "none" })
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
        <view class="title">Profiles</view>
        <button size="mini" @click="refresh">刷新</button>
      </view>
      <view class="muted" style="margin-top: 10rpx">activeProfile={{ hc3.activeProfileId === null ? "null" : hc3.activeProfileId }}</view>
      <view v-if="profiles.length === 0" class="muted" style="margin-top: 10rpx">无 profiles</view>
      <view v-for="p in profiles" :key="p.id" class="profile-row">
        <view>
          <view>{{ p.name || ("Profile " + p.id) }}</view>
          <view class="muted">id={{ p.id }}</view>
        </view>
        <button size="mini" :type="Number(p.id) === hc3.activeProfileId ? 'primary' : 'default'" @click="activate(Number(p.id))">
          {{ Number(p.id) === hc3.activeProfileId ? "当前" : "激活" }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.profile-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
</style>
