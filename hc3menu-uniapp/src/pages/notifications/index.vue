<template>
  <scroll-view scroll-y class="page">
    <view class="card">
      <view class="title"><text>新增规则</text></view>
      <view class="field">
        <text class="label">Device</text>
        <picker :range="deviceNames" :value="deviceIndex" @change="onPickDevice">
          <view class="picker">{{ deviceNames[deviceIndex] || "选择设备" }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Property</text>
        <input class="input" v-model="property" placeholder="例如 value / state / dead / batteryLevel" />
      </view>
      <view class="field">
        <text class="label">Condition</text>
        <input class="input" v-model="condition" placeholder="any / true / false / >20 / <5 / ==1" />
      </view>
      <view class="field">
        <text class="label">Message</text>
        <input class="input" v-model="message" placeholder="{name} {property} -> {newValue}" />
      </view>
      <view class="actions">
        <button size="mini" @click="addRule">添加</button>
      </view>
    </view>

    <view class="card" v-if="rules.length">
      <view class="title"><text>现有规则</text></view>
      <view class="rule" v-for="(r, i) in rules" :key="i">
        <view class="rule-main">
          <text class="r1">{{ deviceNameById(r.deviceId) }}</text>
          <text class="r2">{{ r.property }} · {{ r.condition }}</text>
          <text class="r3">{{ r.message }}</text>
        </view>
        <button size="mini" @click="removeRule(i)">删除</button>
      </view>
    </view>

    <view class="card empty" v-else>
      <text>暂无规则</text>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const hc3 = useHc3Store();
const settings = useSettingsStore();

const devices = computed(() => (hc3.allDevices || []).slice().sort((a: any, b: any) => String(a?.name || "").localeCompare(String(b?.name || ""))));
const deviceNames = computed(() => devices.value.map((d: any) => `${d.name || "Device"} (#${d.id})`));

const deviceIndex = ref(0);
const property = ref("value");
const condition = ref("any");
const message = ref("{name} {property} -> {newValue}");

const rules = computed(() => (settings.config.notifications || []) as any[]);

const onPickDevice = (e: any) => {
  deviceIndex.value = Number(e.detail.value || 0);
};

const deviceNameById = (id: number) => {
  const d = hc3.devices?.[Number(id)];
  return d?.name ? `${d.name} (#${id})` : `#${id}`;
};

const addRule = () => {
  const d = devices.value[deviceIndex.value];
  if (!d) {
    uni.showToast({ title: "请选择设备", icon: "none" });
    return;
  }
  const p = property.value.trim();
  if (!p) {
    uni.showToast({ title: "请输入 property", icon: "none" });
    return;
  }
  const next = (settings.config.notifications || []).slice();
  next.push({
    deviceId: Number(d.id),
    property: p,
    condition: condition.value.trim() || "any",
    message: message.value || "{name} {property} -> {newValue}",
  });
  settings.saveConfig({ notifications: next });
  uni.showToast({ title: "已添加", icon: "success" });
};

const removeRule = (idx: number) => {
  const next = (settings.config.notifications || []).slice();
  next.splice(idx, 1);
  settings.saveConfig({ notifications: next });
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
.title {
  font-size: 30rpx;
  color: #111;
  margin-bottom: 12rpx;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  gap: 20rpx;
}
.label {
  font-size: 26rpx;
  color: #333;
  min-width: 220rpx;
}
.input {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  color: #111;
  padding: 10rpx 0;
}
.picker {
  font-size: 26rpx;
  color: #007aff;
  text-align: right;
}
.actions {
  margin-top: 16rpx;
  display: flex;
  gap: 16rpx;
}
.rule {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid #f0f0f0;
}
.rule:first-of-type {
  border-top: 0;
}
.rule-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.r1 {
  font-size: 26rpx;
  color: #111;
}
.r2 {
  font-size: 22rpx;
  color: #666;
}
.r3 {
  font-size: 22rpx;
  color: #888;
}
.footer-space {
  height: 60rpx;
}
.empty {
  color: #666;
}
</style>

