<script setup lang="ts">
import { computed, ref } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import { useHc3Store } from "../../stores/hc3"
import { useSettingsStore } from "../../stores/settings"

const hc3 = useHc3Store()
const settings = useSettingsStore()

const deviceId = ref<number>(0)
const sliderValue = ref<number>(0)
const tempValue = ref<string>("")
const rgb = ref({ r: 255, g: 255, b: 255, w: 0 })

onLoad(async (q) => {
  deviceId.value = Number((q as any)?.id || 0)
  if (!hc3.devices[deviceId.value]) await hc3.refreshNow()
  const v = Number(hc3.devices[deviceId.value]?.properties?.value)
  if (Number.isFinite(v)) sliderValue.value = v
  const t =
    hc3.devices[deviceId.value]?.properties?.heatingThermostatSetpoint ??
    hc3.devices[deviceId.value]?.properties?.coolingThermostatSetpoint ??
    hc3.devices[deviceId.value]?.properties?.targetLevel
  if (t != null) tempValue.value = String(t)
})

const dev = computed(() => hc3.devices[deviceId.value])
const isFavorite = computed(() => settings.favorites.includes(deviceId.value))
const propsList = computed(() => {
  const p = dev.value?.properties || {}
  return Object.keys(p)
    .sort()
    .map((k) => ({ k, v: p[k] }))
})

function toggleFavorite() {
  settings.toggleFavorite(deviceId.value)
  settings.save()
}

async function doAction(action: string, args?: any[]) {
  try {
    await hc3.deviceAction(deviceId.value, action, args)
    uni.showToast({ title: "已发送", icon: "none" })
  } catch (e: any) {
    uni.showToast({ title: e?.message || "失败", icon: "none" })
  }
}

async function setValue() {
  await doAction("setValue", [Number(sliderValue.value)])
}

async function setHeatSetpoint() {
  const v = Number(tempValue.value)
  if (!Number.isFinite(v)) return
  await doAction("setHeatingThermostatSetpoint", [v])
}

async function setCoolSetpoint() {
  const v = Number(tempValue.value)
  if (!Number.isFinite(v)) return
  await doAction("setCoolingThermostatSetpoint", [v])
}

async function setColor() {
  await doAction("setColor", [rgb.value.r, rgb.value.g, rgb.value.b, rgb.value.w])
}

async function applyFavoriteColor(c: any) {
  if (c?.components && typeof c.components === "object") {
    await doAction("setColorComponents", [c.components])
    return
  }
  const r = Number(c?.r ?? c?.red ?? 0)
  const g = Number(c?.g ?? c?.green ?? 0)
  const b = Number(c?.b ?? c?.blue ?? 0)
  const w = Number(c?.w ?? c?.white ?? 0)
  await doAction("setColor", [r, g, b, w])
}
</script>

<template>
  <view class="page">
    <view class="card" v-if="dev">
      <view class="row">
        <view>
          <view class="title">{{ dev.name || ("Device " + dev.id) }}</view>
          <view class="muted">{{ hc3.roomName(dev.roomID) }} · {{ dev.type || "-" }}</view>
        </view>
        <button size="mini" @click="toggleFavorite">{{ isFavorite ? "★" : "☆" }}</button>
      </view>
    </view>

    <view style="height: 18rpx" />

    <view class="card" v-if="dev">
      <view class="title" style="font-size: 30rpx; margin-bottom: 12rpx">常用操作</view>
      <view class="row" style="justify-content: flex-start; gap: 16rpx; flex-wrap: wrap">
        <button size="mini" type="primary" @click="doAction('turnOn')">开</button>
        <button size="mini" @click="doAction('turnOff')">关</button>
        <button size="mini" @click="doAction('open')">开合-开</button>
        <button size="mini" @click="doAction('close')">开合-关</button>
        <button size="mini" @click="doAction('stop')">开合-停</button>
      </view>

      <view style="height: 18rpx" />

      <view v-if="dev.properties && dev.properties.value != null">
        <view class="muted">setValue (0-100)</view>
        <slider v-model="sliderValue" min="0" max="100" show-value />
        <button size="mini" type="primary" @click="setValue">设置</button>
      </view>

      <view style="height: 18rpx" />

      <view v-if="dev.properties && (dev.properties.heatingThermostatSetpoint != null || dev.properties.coolingThermostatSetpoint != null || dev.properties.targetLevel != null)">
        <view class="muted">恒温器设定值</view>
        <input v-model="tempValue" type="digit" placeholder="例如 21.5" />
        <view class="row" style="justify-content: flex-start; gap: 16rpx; margin-top: 10rpx">
          <button size="mini" type="primary" @click="setHeatSetpoint">Heat</button>
          <button size="mini" @click="setCoolSetpoint">Cool</button>
        </view>
      </view>

      <view style="height: 18rpx" />

      <view>
        <view class="muted">颜色 (setColor r,g,b,w)</view>
        <view class="row" style="justify-content: flex-start; gap: 12rpx; flex-wrap: wrap">
          <input v-model.number="rgb.r" type="number" style="width: 120rpx" />
          <input v-model.number="rgb.g" type="number" style="width: 120rpx" />
          <input v-model.number="rgb.b" type="number" style="width: 120rpx" />
          <input v-model.number="rgb.w" type="number" style="width: 120rpx" />
          <button size="mini" type="primary" @click="setColor">设置</button>
        </view>
      </view>

      <view style="height: 18rpx" />

      <view v-if="hc3.favoriteColors && hc3.favoriteColors.length">
        <view class="muted">HC3 Favorite colors</view>
        <view class="row" style="justify-content: flex-start; gap: 12rpx; flex-wrap: wrap; margin-top: 10rpx">
          <button v-for="c in hc3.favoriteColors.slice(0, 12)" :key="c.id" size="mini" @click="applyFavoriteColor(c)">
            {{ c.name || ("Color " + c.id) }}
          </button>
        </view>
      </view>
    </view>

    <view style="height: 18rpx" />

    <view class="card" v-if="dev">
      <view class="title" style="font-size: 30rpx; margin-bottom: 12rpx">属性</view>
      <view v-if="propsList.length === 0" class="muted">无 properties</view>
      <view v-for="p in propsList" :key="p.k" class="prop-row">
        <view class="muted">{{ p.k }}</view>
        <view class="val">{{ String(p.v) }}</view>
      </view>
    </view>

    <view class="muted" v-else>未找到设备</view>
  </view>
</template>

<style scoped lang="scss">
.prop-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #eee;
}
.val {
  max-width: 60%;
  text-align: right;
  word-break: break-all;
}
</style>
