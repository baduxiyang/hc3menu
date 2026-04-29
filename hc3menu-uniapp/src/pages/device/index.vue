<template>
  <scroll-view scroll-y class="page" v-if="device">
    <view class="card">
      <view class="title">
        <text class="name">{{ device.name || ("Device " + device.id) }}</text>
        <text class="meta">{{ roomName }} · {{ device.type || device.baseType }}</text>
      </view>
      <view class="actions">
        <button size="mini" @click="toggleFav">{{ isFav ? "★ Remove favorite" : "☆ Add favorite" }}</button>
        <button size="mini" @click="refreshOne">刷新</button>
      </view>
    </view>

    <view class="card" v-if="kind === 'switch'">
      <view class="row">
        <text class="label">State</text>
        <switch :checked="isOn" @change="onSwitchChange" />
      </view>
    </view>

    <view class="card" v-if="kind === 'dimmer'">
      <view class="row">
        <text class="label">State</text>
        <switch :checked="isOn" @change="onSwitchChange" />
      </view>
      <view class="row col">
        <text class="label">Value {{ valueNum }}%</text>
        <slider :value="valueNum" min="0" max="100" @change="onSliderChange" />
      </view>
    </view>

    <view class="card" v-if="kind === 'shutter'">
      <view class="row">
        <button size="mini" @click="hc3.shutterOpen(deviceId)">Open</button>
        <button size="mini" @click="hc3.shutterStop(deviceId)">Stop</button>
        <button size="mini" @click="hc3.shutterClose(deviceId)">Close</button>
      </view>
      <view class="row col">
        <text class="label">Position {{ valueNum }}%</text>
        <slider :value="valueNum" min="0" max="100" @change="onSliderChange" />
      </view>
      <view class="row preset">
        <button v-for="v in [0,25,50,75,100]" :key="v" size="mini" @click="setValue(v)">{{ v }}%</button>
      </view>
    </view>

    <view class="card" v-if="kind === 'thermostat'">
      <view class="row">
        <text class="label">Mode</text>
        <picker :range="['Heat','Cool']" :value="modeIndex" @change="onModePick">
          <view class="picker">{{ mode }}</view>
        </picker>
      </view>
      <view class="row col">
        <text class="label">Setpoint {{ setpoint }}</text>
        <slider :value="Number(setpoint)" min="10" max="30" @change="onSetpointSlider" />
      </view>
      <view class="row preset">
        <button v-for="v in [18,20,22,24,26]" :key="v" size="mini" @click="applyThermostat(v)">{{ v }}°</button>
      </view>
    </view>

    <view class="card" v-if="kind === 'color'">
      <view class="row">
        <text class="label">Brightness</text>
        <text class="value">{{ brightness }}%</text>
      </view>
      <view class="row col">
        <slider :value="brightness" min="0" max="100" @changing="onBrightnessChanging" @change="onBrightnessChange" />
      </view>
      <view class="row col">
        <text class="label">Hex</text>
        <input class="input" v-model="hex" placeholder="#RRGGBB 或 #RRGGBBWW" />
        <button size="mini" @click="applyHex">Apply</button>
      </view>
      <view class="row col" v-if="favoriteColors.length">
        <text class="label">Favorite colors</text>
        <view class="fav-colors">
          <button v-for="c in favoriteColors" :key="cKey(c)" size="mini" @click="applyFavorite(c)">{{ cLabel(c) }}</button>
        </view>
      </view>
    </view>

    <view class="card" v-if="kind.endsWith('_sensor') || kind === 'sensor'">
      <view class="row">
        <text class="label">Value</text>
        <text class="value">{{ String(device?.properties?.value ?? '') }}</text>
      </view>
      <view class="row" v-if="device?.properties?.unit">
        <text class="label">Unit</text>
        <text class="value">{{ String(device?.properties?.unit) }}</text>
      </view>
      <view class="row" v-if="device?.properties?.state != null">
        <text class="label">State</text>
        <text class="value">{{ String(device?.properties?.state) }}</text>
      </view>
    </view>

    <view class="footer-space"></view>
  </scroll-view>

  <view v-else class="empty">
    <text>设备不存在或尚未同步</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useHc3Store } from "@/stores/hc3";
import { useSettingsStore } from "@/stores/settings";

const SWITCH_TYPES = new Set(["com.fibaro.binarySwitch", "com.fibaro.developer.bxt.binarySwitch", "com.fibaro.FGWP101", "com.fibaro.FGWP102"]);
const DIMMER_TYPES = new Set(["com.fibaro.multilevelSwitch", "com.fibaro.FGD212"]);
const SHUTTER_TYPES = new Set(["com.fibaro.FGRM222", "com.fibaro.rollerShutter", "com.fibaro.baseShutter"]);
const TEMP_SENSOR_TYPES = new Set(["com.fibaro.temperatureSensor"]);
const LUX_SENSOR_TYPES = new Set(["com.fibaro.lightSensor"]);
const HUMIDITY_TYPES = new Set(["com.fibaro.humiditySensor"]);
const MOTION_TYPES = new Set(["com.fibaro.motionSensor"]);
const THERMOSTAT_TYPES = new Set(["com.fibaro.hvacSystem", "com.fibaro.thermostatDanfoss", "com.fibaro.thermostatHorstmann", "com.fibaro.setPoint"]);
const COLOR_CONTROLLER_TYPES = new Set(["com.fibaro.colorController"]);

const classify = (d: any): string => {
  const t = String(d?.type || "");
  const base = String(d?.baseType || "");
  if (COLOR_CONTROLLER_TYPES.has(t) || COLOR_CONTROLLER_TYPES.has(base)) return "color";
  if (SWITCH_TYPES.has(t) || SWITCH_TYPES.has(base)) return "switch";
  if (DIMMER_TYPES.has(t) || DIMMER_TYPES.has(base)) return "dimmer";
  if (SHUTTER_TYPES.has(t) || SHUTTER_TYPES.has(base)) return "shutter";
  if (TEMP_SENSOR_TYPES.has(t) || TEMP_SENSOR_TYPES.has(base)) return "temp_sensor";
  if (LUX_SENSOR_TYPES.has(t) || LUX_SENSOR_TYPES.has(base)) return "lux_sensor";
  if (HUMIDITY_TYPES.has(t) || HUMIDITY_TYPES.has(base)) return "humidity_sensor";
  if (MOTION_TYPES.has(t) || MOTION_TYPES.has(base)) return "motion_sensor";
  if (THERMOSTAT_TYPES.has(t) || THERMOSTAT_TYPES.has(base)) return "thermostat";
  return "sensor";
};

const truthy = (v: any): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (typeof v === "string") return ["true", "1", "on", "yes"].includes(v.toLowerCase());
  return false;
};

const hc3 = useHc3Store();
const settings = useSettingsStore();

const deviceId = ref(0);
const mode = ref<"Heat" | "Cool">("Heat");
const setpoint = ref<number>(22);
const hex = ref("");

const device = computed(() => hc3.devices?.[deviceId.value]);
const kind = computed(() => classify(device.value));
const roomName = computed(() => hc3.roomName(Number(device.value?.roomID ?? 0)));

const isFav = computed(() => (settings.config.favorites || []).includes(deviceId.value));
const toggleFav = () => settings.toggleFavorite(deviceId.value);

const valueNum = computed(() => {
  const v = device.value?.properties?.value;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
});

const isOn = computed(() => truthy(device.value?.properties?.value ?? device.value?.properties?.state));

const onSwitchChange = (e: any) => {
  const next = Boolean(e.detail.value);
  hc3.toggleSwitch(deviceId.value, next).catch(() => {});
};

const setValue = (v: number) => {
  hc3.setDimmerValue(deviceId.value, v).catch(() => {});
};

const onSliderChange = (e: any) => {
  const v = Number(e.detail.value ?? 0);
  setValue(v);
};

const modeIndex = computed(() => (mode.value === "Heat" ? 0 : 1));
const onModePick = (e: any) => {
  mode.value = Number(e.detail.value) === 1 ? "Cool" : "Heat";
};

const applyThermostat = (t: number) => {
  setpoint.value = Number(t);
  hc3.setThermostat(deviceId.value, Number(t), mode.value).catch(() => {});
};

const onSetpointSlider = (e: any) => {
  const v = Number(e.detail.value ?? 22);
  applyThermostat(v);
};

const brightness = computed(() => {
  const cc = device.value?.properties?.colorComponents || {};
  const b = Number(device.value?.properties?.value ?? cc?.brightness ?? 0);
  return Number.isFinite(b) ? Math.round(b) : 0;
});

const brightnessLastSentMs = ref(0);

const setBrightness = (v: number, throttle: boolean) => {
  const next = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  if (throttle) {
    const now = Date.now();
    if (now - brightnessLastSentMs.value < 120) return;
    brightnessLastSentMs.value = now;
  }
  hc3.setDimmerValue(deviceId.value, next).catch(() => {});
};

const onBrightnessChanging = (e: any) => {
  setBrightness(Number(e.detail.value ?? 0), true);
};

const onBrightnessChange = (e: any) => {
  setBrightness(Number(e.detail.value ?? 0), false);
};

const parseHex = (s: string): { r: number; g: number; b: number; w: number } | null => {
  const t = (s || "").trim().replace(/^#/, "");
  if (t.length === 3) {
    const r = parseInt(t[0] + t[0], 16);
    const g = parseInt(t[1] + t[1], 16);
    const b = parseInt(t[2] + t[2], 16);
    return { r, g, b, w: 0 };
  }
  if (t.length === 6) {
    return { r: parseInt(t.slice(0, 2), 16), g: parseInt(t.slice(2, 4), 16), b: parseInt(t.slice(4, 6), 16), w: 0 };
  }
  if (t.length === 8) {
    return { r: parseInt(t.slice(0, 2), 16), g: parseInt(t.slice(2, 4), 16), b: parseInt(t.slice(4, 6), 16), w: parseInt(t.slice(6, 8), 16) };
  }
  return null;
};

const applyHex = () => {
  const p = parseHex(hex.value);
  if (!p) {
    uni.showToast({ title: "Hex 格式错误", icon: "none" });
    return;
  }
  hc3.runDeviceAction(() => hc3.ensureClient().setColor(deviceId.value, p.r, p.g, p.b, p.w)).catch(() => {});
};

const favoriteColors = computed(() => hc3.favoriteColors || []);
const cKey = (c: any) => String(c?.id ?? c?.name ?? JSON.stringify(c));
const cLabel = (c: any) => String(c?.name || c?.id || "color");
const applyFavorite = (c: any) => {
  const comp = c?.components;
  if (comp && typeof comp === "object") {
    hc3.runDeviceAction(() => hc3.ensureClient().setColorComponents(deviceId.value, comp)).catch(() => {});
    return;
  }
  const r = Number(c?.r ?? c?.red ?? 0);
  const g = Number(c?.g ?? c?.green ?? 0);
  const b = Number(c?.b ?? c?.blue ?? 0);
  const w = Number(c?.w ?? c?.white ?? 0);
  hc3.runDeviceAction(() => hc3.ensureClient().setColor(deviceId.value, r, g, b, w)).catch(() => {});
};

const refreshOne = async () => {
  const d = await hc3.ensureClient().getDevice(deviceId.value).catch(() => null);
  if (d && d.id != null) hc3.devices = { ...hc3.devices, [Number(d.id)]: d };
};

onLoad((q) => {
  deviceId.value = Number((q as any)?.id || 0);
});
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
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.name {
  font-size: 34rpx;
  color: #111;
}
.meta {
  font-size: 24rpx;
  color: #777;
}
.actions {
  margin-top: 16rpx;
  display: flex;
  gap: 16rpx;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 12rpx 0;
}
.row.col {
  flex-direction: column;
  align-items: stretch;
}
.row.preset {
  flex-wrap: wrap;
  justify-content: flex-start;
}
.label {
  font-size: 26rpx;
  color: #333;
}
.value {
  font-size: 26rpx;
  color: #666;
}
.picker {
  font-size: 26rpx;
  color: #007aff;
}
.input {
  width: 100%;
  font-size: 26rpx;
  color: #111;
  padding: 14rpx 0;
}
.fav-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.footer-space {
  height: 60rpx;
}
.empty {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}
</style>
