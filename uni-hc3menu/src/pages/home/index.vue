<script setup lang="ts">
import { computed, ref } from "vue"
import { onPullDownRefresh } from "@dcloudio/uni-app"
import DeviceRow from "../../components/DeviceRow.vue"
import { useHc3Store } from "../../stores/hc3"
import { useSettingsStore } from "../../stores/settings"

const hc3 = useHc3Store()
const settings = useSettingsStore()
const tab = ref<"favorites" | "rooms">("favorites")

const favorites = computed(() => settings.favorites)
const devices = computed(() => hc3.deviceList)

const favoriteDevices = computed(() => {
  const ids = new Set(favorites.value.map((x) => Number(x)))
  return devices.value.filter((d) => ids.has(Number(d.id)))
})

const rooms = computed(() => Object.values(hc3.rooms))

const devicesByRoom = computed(() => {
  const map: Record<number, any[]> = {}
  for (const d of devices.value) {
    const rid = Number(d.roomID || 0)
    if (!map[rid]) map[rid] = []
    map[rid].push(d)
  }
  for (const k of Object.keys(map)) {
    map[Number(k)].sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")))
  }
  return map
})

function openDevice(id: number) {
  uni.navigateTo({ url: `/pages/device/detail?id=${id}` })
}

async function refresh() {
  await hc3.refreshNow()
  uni.stopPullDownRefresh()
}

function toggleFavorite(id: number) {
  settings.toggleFavorite(id)
  settings.save()
}

function openSearch() {
  uni.navigateTo({ url: "/pages/search/index" })
}

onPullDownRefresh(refresh)
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <view>
          <view class="title">HC3</view>
          <view class="muted">
            <text v-if="hc3.connected">已连接</text>
            <text v-else>未连接：{{ hc3.lastError || "请到设置配置" }}</text>
          </view>
        </view>
        <view class="row">
          <button size="mini" @click="openSearch">搜索</button>
          <button size="mini" @click="refresh">刷新</button>
        </view>
      </view>
    </view>

    <view style="height: 18rpx" />

    <view class="row tabs">
      <button size="mini" :type="tab === 'favorites' ? 'primary' : 'default'" @click="tab = 'favorites'">收藏</button>
      <button size="mini" :type="tab === 'rooms' ? 'primary' : 'default'" @click="tab = 'rooms'">房间</button>
    </view>

    <view style="height: 12rpx" />

    <view class="card" v-if="tab === 'favorites'">
      <view v-if="favoriteDevices.length === 0" class="muted">暂无收藏</view>
      <DeviceRow
        v-for="d in favoriteDevices"
        :key="d.id"
        :device="d"
        :roomName="hc3.roomName(d.roomID)"
        :favorite="true"
        @open="openDevice"
        @toggleFavorite="toggleFavorite"
      />
    </view>

    <view v-else>
      <view v-for="r in rooms" :key="r.id" class="card" style="margin-bottom: 18rpx">
        <view class="title" style="font-size: 30rpx; margin-bottom: 10rpx">{{ r.name || "Unassigned" }}</view>
        <DeviceRow
          v-for="d in devicesByRoom[r.id] || []"
          :key="d.id"
          :device="d"
          :roomName="hc3.roomName(d.roomID)"
          :favorite="favorites.includes(Number(d.id))"
          @open="openDevice"
          @toggleFavorite="toggleFavorite"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabs {
  justify-content: flex-start;
  gap: 16rpx;
}
</style>

