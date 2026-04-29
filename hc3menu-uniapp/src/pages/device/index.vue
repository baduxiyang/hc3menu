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
        <picker :range="supportedThermostatModes" :value="thermoModeIndex" @change="onThermoModePick">
          <view class="picker">{{ thermoMode }}</view>
        </picker>
      </view>
      <view class="row" v-if="fanSupported">
        <text class="label">Fan</text>
        <picker :range="fanOptions" :value="fanIndex" @change="onFanPick">
          <view class="picker">{{ fanValueLabel }}</view>
        </picker>
      </view>
      <view class="row col">
        <text class="label">Setpoint {{ thermoSetpoint }}°{{ thermoUnit }}</text>
        <slider
          :value="thermoSetpoint"
          :min="thermoMin"
          :max="thermoMax"
          :step="thermoStep"
          :disabled="thermoMode === 'Off'"
          @changing="onThermoSetpointChanging"
          @change="onThermoSetpointChange"
        />
      </view>
      <view class="row preset">
        <button v-for="v in thermoPresets" :key="v" size="mini" :disabled="thermoMode === 'Off'" @click="applyThermostat(v)">{{ v }}°</button>
      </view>
    </view>

    <view class="card" v-if="kind === 'color'">
      <view class="row">
        <text class="label">Color</text>
        <view class="color-wrap">
          <view class="swatch" :style="colorPreviewStyle"></view>
          <text class="value">{{ colorHex }}</text>
        </view>
      </view>
      <view class="row col">
        <text class="label">Channels</text>
        <view class="chan">
          <text class="chip">R {{ channels.r }}</text>
          <text class="chip">G {{ channels.g }}</text>
          <text class="chip">B {{ channels.b }}</text>
          <text class="chip">W {{ channels.w }}</text>
          <text class="chip">WW {{ channels.ww }}</text>
          <text class="chip">CW {{ channels.cw }}</text>
        </view>
      </view>
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

    <view class="card" v-if="uiView.length">
      <QuickAppUIView :device-id="deviceId" :ui-view="uiView" />
    </view>

    <view class="card">
      <view class="json-actions">
        <text class="json-title">Raw JSON</text>
        <button size="mini" @click="copyJson">复制</button>
      </view>
      <textarea class="json-box" :value="rawText" :maxlength="-1" auto-height disabled />
    </view>

    <view class="footer-space"></view>
  </scroll-view>

  <view v-else class="empty">
    <text>设备不存在或尚未同步</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import QuickAppUIView from "@/components/QuickAppUIView.vue";
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
const DEVICE_CONTROLLER_TYPES = new Set(["com.fibaro.deviceController"]);

const classify = (d: any): string => {
  const t = String(d?.type || "");
  const base = String(d?.baseType || "");
  if (DEVICE_CONTROLLER_TYPES.has(t) || DEVICE_CONTROLLER_TYPES.has(base)) return "device_controller";
  if (COLOR_CONTROLLER_TYPES.has(t)) return "color";
  if (DIMMER_TYPES.has(t)) return "dimmer";
  if (SWITCH_TYPES.has(t)) return "switch";
  if (SHUTTER_TYPES.has(t)) return "shutter";
  if (THERMOSTAT_TYPES.has(t)) return "thermostat";
  if (TEMP_SENSOR_TYPES.has(t)) return "temp_sensor";
  if (LUX_SENSOR_TYPES.has(t)) return "lux_sensor";
  if (HUMIDITY_TYPES.has(t)) return "humidity_sensor";
  if (MOTION_TYPES.has(t)) return "motion_sensor";

  if (COLOR_CONTROLLER_TYPES.has(base)) return "color";
  if (DIMMER_TYPES.has(base)) return "dimmer";
  if (SWITCH_TYPES.has(base)) return "switch";
  if (SHUTTER_TYPES.has(base)) return "shutter";
  if (THERMOSTAT_TYPES.has(base)) return "thermostat";
  if (TEMP_SENSOR_TYPES.has(base)) return "temp_sensor";
  if (LUX_SENSOR_TYPES.has(base)) return "lux_sensor";
  if (HUMIDITY_TYPES.has(base)) return "humidity_sensor";
  if (MOTION_TYPES.has(base)) return "motion_sensor";
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
const hex = ref("");
const rawDevice = ref<any | null>(null);

const device = computed(() => hc3.devices?.[deviceId.value]);
const kind = computed(() => classify(device.value));
const roomName = computed(() => hc3.roomName(Number(device.value?.roomID ?? 0)));
const rawText = computed(() => {
  const src = rawDevice.value ?? device.value ?? {};
  try {
    return JSON.stringify(src, null, 2);
  } catch {
    return String(src);
  }
});

const uiView = computed(() => {
  const d = rawDevice.value ?? device.value;
  const v = d?.properties?.uiView;
  return Array.isArray(v) ? v : [];
});

const isFav = computed(() => (settings.config.favorites || []).includes(deviceId.value));
const toggleFav = () => settings.toggleFavorite(deviceId.value);

const valueNum = computed(() => {
  const v = device.value?.properties?.value;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.round(n);
  const on = truthy(device.value?.properties?.state);
  return on ? 100 : 0;
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

const thermoUnit = computed(() => String(device.value?.properties?.unit || "C"));
const supportedThermostatModes = computed(() => {
  const ms = device.value?.properties?.supportedThermostatModes;
  if (Array.isArray(ms) && ms.length) return ms.map((x: any) => String(x));
  return ["Heat", "Cool"];
});
const thermoMode = computed(() => {
  const m = String(device.value?.properties?.thermostatMode || "");
  if (m && supportedThermostatModes.value.includes(m)) return m;
  return supportedThermostatModes.value[0] || "Heat";
});
const thermoModeIndex = computed(() => Math.max(0, supportedThermostatModes.value.indexOf(thermoMode.value)));
const onThermoModePick = (e: any) => {
  const idx = Number(e.detail.value ?? 0);
  const next = supportedThermostatModes.value[idx] || supportedThermostatModes.value[0] || "Heat";
  hc3.setThermostatMode(deviceId.value, next as any).catch(() => {});
};

const thermoSetpoint = computed(() => {
  const p = device.value?.properties || {};
  if (thermoMode.value === "Auto") return Number(p.autoThermostatSetpoint ?? 0);
  if (thermoMode.value === "Heat") return Number(p.heatingThermostatSetpoint ?? 0);
  if (thermoMode.value === "Cool") return Number(p.coolingThermostatSetpoint ?? 0);
  return 0;
});

const thermoMin = computed(() => {
  const p = device.value?.properties || {};
  if (thermoMode.value === "Auto") return Number(p.autoThermostatSetpointCapabilitiesMin ?? 4);
  if (thermoMode.value === "Heat") return Number(p.heatingThermostatSetpointCapabilitiesMin ?? 4);
  if (thermoMode.value === "Cool") return Number(p.coolingThermostatSetpointCapabilitiesMin ?? 4);
  return 0;
});

const thermoMax = computed(() => {
  const p = device.value?.properties || {};
  if (thermoMode.value === "Auto") return Number(p.autoThermostatSetpointCapabilitiesMax ?? 30);
  if (thermoMode.value === "Heat") return Number(p.heatingThermostatSetpointCapabilitiesMax ?? 30);
  if (thermoMode.value === "Cool") return Number(p.coolingThermostatSetpointCapabilitiesMax ?? 30);
  return 0;
});

const thermoStep = computed(() => {
  const p = device.value?.properties || {};
  const unit = thermoUnit.value;
  const stepFrom = (obj: any) => {
    if (!obj || typeof obj !== "object") return null;
    const v = Number(obj[unit]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  let step: number | null = null;
  if (thermoMode.value === "Auto") step = stepFrom(p.autoThermostatSetpointStep);
  if (thermoMode.value === "Heat") step = stepFrom(p.heatingThermostatSetpointStep);
  if (thermoMode.value === "Cool") step = stepFrom(p.coolingThermostatSetpointStep);
  if (step != null) return step;
  return unit === "F" ? 1 : 0.5;
});

const thermoPresets = computed(() => {
  const preset = [18, 20, 22, 24, 26];
  const min = Number(thermoMin.value);
  const max = Number(thermoMax.value);
  return preset.filter((x) => x >= min && x <= max);
});

const fanOptions = computed(() => {
  const p = device.value?.properties || {};
  const ms = p.supportedFanModes;
  if (Array.isArray(ms) && ms.length) return ms.map((x: any) => String(x));
  const ss = p.supportedFanSpeeds;
  if (Array.isArray(ss) && ss.length) return ss.map((x: any) => String(x));
  return [];
});

const fanSupported = computed(() => {
  const d = rawDevice.value ?? device.value;
  const a = d?.actions || {};
  const hasAction = Boolean(a.setFanMode || a.setFanSpeed);
  return fanOptions.value.length > 0 && hasAction;
});

const fanValueLabel = computed(() => {
  const p = device.value?.properties || {};
  const v = p.fanMode ?? p.fanSpeed;
  return v != null && String(v) ? String(v) : "请选择";
});

const fanIndex = computed(() => {
  const v = fanValueLabel.value;
  const idx = fanOptions.value.indexOf(String(v));
  return idx >= 0 ? idx : 0;
});

const onFanPick = (e: any) => {
  const idx = Number(e.detail.value ?? 0);
  const next = fanOptions.value[idx];
  if (!next) return;
  const d = rawDevice.value ?? device.value;
  const a = d?.actions || {};
  if (a.setFanMode) hc3.setFanMode(deviceId.value, next).catch(() => {});
  else if (a.setFanSpeed) hc3.setFanSpeed(deviceId.value, next).catch(() => {});
};

const thermoLastSentMs = ref(0);
const setThermoSetpoint = (v: number, throttle: boolean) => {
  if (thermoMode.value === "Off") return;
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  const next = Math.max(thermoMin.value, Math.min(thermoMax.value, n));
  if (throttle) {
    const now = Date.now();
    if (now - thermoLastSentMs.value < 150) return;
    thermoLastSentMs.value = now;
  }
  const m = thermoMode.value;
  if (m !== "Auto" && m !== "Heat" && m !== "Cool") return;
  hc3.setThermostatSetpoint(deviceId.value, next, m).catch(() => {});
};

const onThermoSetpointChanging = (e: any) => setThermoSetpoint(Number(e.detail.value ?? 0), true);
const onThermoSetpointChange = (e: any) => setThermoSetpoint(Number(e.detail.value ?? 0), false);

const applyThermostat = (t: number) => setThermoSetpoint(Number(t), false);

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
  if (d && d.id != null) {
    hc3.devices = { ...hc3.devices, [Number(d.id)]: d };
    rawDevice.value = d;
  }
};

const copyJson = () => {
  const t = rawText.value || "";
  if (!t) return;
  uni.setClipboardData({ data: t, success: () => uni.showToast({ title: "已复制", icon: "success" }) });
};

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const toHex2 = (n: number) => clamp255(n).toString(16).padStart(2, "0").toUpperCase();

const channels = computed(() => {
  const cc = device.value?.properties?.colorComponents || {};
  return {
    r: clamp255(Number(cc?.red ?? 0)),
    g: clamp255(Number(cc?.green ?? 0)),
    b: clamp255(Number(cc?.blue ?? 0)),
    w: clamp255(Number(cc?.white ?? cc?.w ?? 0)),
    ww: clamp255(Number(cc?.warmWhite ?? 0)),
    cw: clamp255(Number(cc?.coldWhite ?? 0)),
  };
});

const colorRgb = computed(() => {
  const r0 = channels.value.r;
  const g0 = channels.value.g;
  const b0 = channels.value.b;
  const ww = channels.value.ww;
  const cw = channels.value.cw;
  const w = channels.value.w;
  const white = Math.max(ww, cw, w);
  const mix = Math.max(0, Math.min(1, white / 255));
  const r1 = r0 * (1 - mix) + 255 * mix;
  const g1 = g0 * (1 - mix) + 255 * mix;
  const b1 = b0 * (1 - mix) + 255 * mix;
  const br = Math.max(0, Math.min(1, (Number(brightness.value) || 0) / 100));
  return {
    r: clamp255(r1 * br),
    g: clamp255(g1 * br),
    b: clamp255(b1 * br),
  };
});

const colorHex = computed(() => {
  const { r, g, b } = colorRgb.value;
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
});

const colorPreviewStyle = computed(() => {
  const { r, g, b } = colorRgb.value;
  return `background: rgb(${r},${g},${b});`;
});

onLoad((q) => {
  deviceId.value = Number((q as any)?.id || 0);
  refreshOne().catch(() => {});
});

onShow(() => {
  if (deviceId.value) refreshOne().catch(() => {});
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
.color-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.swatch {
  width: 36rpx;
  height: 36rpx;
  border-radius: 10rpx;
  border: 1rpx solid #e6e6e6;
}
.chan {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding-top: 6rpx;
}
.chip {
  font-size: 22rpx;
  color: #333;
  padding: 10rpx 14rpx;
  border-radius: 999rpx;
  background: #f0f2f6;
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

.json-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.json-title {
  font-size: 28rpx;
  color: #111;
}
.json-box {
  width: 100%;
  min-height: 260rpx;
  padding: 14rpx;
  border-radius: 12rpx;
  background: #0b1020;
  color: #e6edf3;
  font-size: 22rpx;
  line-height: 32rpx;
  box-sizing: border-box;
}
</style>
