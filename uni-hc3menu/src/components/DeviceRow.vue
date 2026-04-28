<script setup lang="ts">
import type { Hc3Device } from "../types/hc3"

const props = defineProps<{
  device: Hc3Device
  roomName: string
  favorite?: boolean
}>()

const emit = defineEmits<{
  (e: "open", id: number): void
  (e: "toggleFavorite", id: number): void
}>()

function open() {
  emit("open", Number(props.device.id))
}

function toggleFav() {
  emit("toggleFavorite", Number(props.device.id))
}
</script>

<template>
  <view class="row device" @click="open">
    <view class="left">
      <view class="name">{{ device.name || ("Device " + device.id) }}</view>
      <view class="muted">{{ roomName }} · {{ device.type || "-" }}</view>
    </view>
    <view class="right">
      <button class="fav" size="mini" @click.stop="toggleFav">{{ favorite ? "★" : "☆" }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.device {
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.name {
  font-size: 30rpx;
}
.fav {
  line-height: 1;
  padding: 0 14rpx;
}
</style>

