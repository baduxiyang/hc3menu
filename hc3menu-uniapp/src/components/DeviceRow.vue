<template>
  <view class="row" @click="onOpen">
    <view class="left">
      <text class="name">{{ device?.name || ("Device " + device?.id) }}</text>
      <text class="sub">{{ subtitle }}</text>
    </view>
    <view class="right">
      <text class="fav" @click.stop="onFav">{{ isFavorite ? "★" : "☆" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  device: any;
  isFavorite: boolean;
}>();

const emit = defineEmits<{
  (e: "open", id: number): void;
  (e: "toggle-fav", id: number): void;
}>();

const subtitle = computed(() => {
  const p = props.device?.properties || {};
  const dead = Boolean(p.dead);
  if (dead) return "dead";
  if (p.batteryLevel != null) return `battery ${p.batteryLevel}%`;
  if (p.value != null) return `value ${p.value}`;
  if (p.state != null) return `state ${p.state}`;
  return props.device?.type || props.device?.baseType || "";
});

const onOpen = () => {
  emit("open", Number(props.device?.id));
};

const onFav = () => {
  emit("toggle-fav", Number(props.device?.id));
};
</script>

<style scoped lang="scss">
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.name {
  font-size: 30rpx;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520rpx;
}
.sub {
  font-size: 24rpx;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520rpx;
}
.right {
  display: flex;
  align-items: center;
}
.fav {
  font-size: 36rpx;
  color: #ffb300;
}
</style>

