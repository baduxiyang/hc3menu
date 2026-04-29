<template>
  <view class="root" v-if="rows.length">
    <view class="row" v-for="(row, idx) in rows" :key="idx" :class="row.dir">
      <template v-for="c in row.components" :key="c.name">
        <view v-if="c.type === 'space'" class="space" :style="weightStyle(c.weight)"></view>

        <view v-else-if="c.type === 'label'" class="label" :style="weightStyle(c.weight)">
          <text>{{ c.text }}</text>
        </view>

        <view v-else-if="c.type === 'select' && c.selectionType === 'single'" class="select" :style="weightStyle(c.weight)">
          <picker :range="c.items.map((x) => x.label)" :value="c.selectedIndex" @change="(e: any) => onPickSingle(c, e)">
            <view class="picker">{{ c.items[c.selectedIndex]?.label || c.text || c.name }}</view>
          </picker>
        </view>

        <view v-else-if="c.type === 'select' && c.selectionType === 'multi'" class="select" :style="weightStyle(c.weight)">
          <view class="picker">{{ c.text || c.name }}</view>
          <checkbox-group @change="(e: any) => onPickMulti(c, e)">
            <label class="cb" v-for="it in c.items" :key="it.value">
              <checkbox :value="String(it.value)" :checked="c.selectedValues.includes(String(it.value))" />
              <text class="cb-text">{{ it.label }}</text>
            </label>
          </checkbox-group>
        </view>

        <view v-else-if="c.type === 'button'" class="btn" :style="weightStyle(c.weight)">
          <button
            size="mini"
            @touchstart="(e) => onBtnTouchStart(c, e)"
            @touchend="(e) => onBtnTouchEnd(c, e)"
            @touchcancel="(e) => onBtnTouchCancel(c, e)"
          >
            {{ c.text || c.name }}
          </button>
        </view>
      </template>
    </view>
  </view>
  <view v-else class="empty">
    <text>该设备未提供 uiView</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useHc3Store } from "@/stores/hc3";

type RawBinding = {
  type: string;
  params?: { actionName?: string; args?: any[] };
};

type RawComponent = {
  name?: string;
  type?: string;
  text?: string;
  visible?: boolean;
  style?: { weight?: string | number };
  selectionType?: "single" | "multi";
  values?: any[];
  options?: any[];
  eventBinding?: Record<string, RawBinding[]>;
};

type RawRow = {
  type?: "horizontal" | "vertical";
  style?: { weight?: string | number };
  components?: RawComponent[];
};

const props = defineProps<{
  deviceId: number;
  uiView: RawRow[];
}>();

const hc3 = useHc3Store();

const numWeight = (w: any): number => {
  const n = Number(w);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const weightStyle = (w: any) => {
  return `flex: ${numWeight(w)};`;
};

type SelectItem = { label: string; value: string };

type VmComponent =
  | { type: "space"; name: string; weight: number }
  | { type: "label"; name: string; text: string; weight: number }
  | {
      type: "select";
      name: string;
      text: string;
      selectionType: "single" | "multi";
      weight: number;
      items: SelectItem[];
      selectedIndex: number;
      selectedValues: string[];
      eventBinding?: Record<string, RawBinding[]>;
    }
  | { type: "button"; name: string; text: string; weight: number; eventBinding?: Record<string, RawBinding[]> };

type VmRow = { dir: "h" | "v"; components: VmComponent[] };

const toItems = (c: RawComponent): SelectItem[] => {
  const out: SelectItem[] = [];
  const opts = Array.isArray(c.options) ? c.options : [];
  if (opts.length) {
    for (const o of opts) {
      if (o && typeof o === "object") {
        const label = String((o as any).text ?? (o as any).label ?? (o as any).name ?? (o as any).value ?? "");
        const value = String((o as any).value ?? (o as any).id ?? label);
        if (label) out.push({ label, value });
      } else {
        out.push({ label: String(o), value: String(o) });
      }
    }
    return out;
  }
  const values = Array.isArray(c.values) ? c.values : [];
  for (const v of values) out.push({ label: String(v), value: String(v) });
  return out;
};

const rows = computed<VmRow[]>(() => {
  const src = Array.isArray(props.uiView) ? props.uiView : [];
  const out: VmRow[] = [];
  for (const r of src) {
    const dir: "h" | "v" = r?.type === "vertical" ? "v" : "h";
    const comps: VmComponent[] = [];
    const cs = Array.isArray(r?.components) ? r.components : [];
    for (const c of cs) {
      if (c?.visible === false) continue;
      const t = String(c?.type || "");
      const name = String(c?.name || `${t}-${comps.length}`);
      const weight = numWeight(c?.style?.weight);
      if (t === "space") {
        comps.push({ type: "space", name, weight });
        continue;
      }
      if (t === "label") {
        comps.push({ type: "label", name, text: String(c?.text || ""), weight });
        continue;
      }
      if (t === "select") {
        const items = toItems(c);
        const selectionType = (c?.selectionType === "multi" ? "multi" : "single") as "single" | "multi";
        const selectedIndex = 0;
        const selectedValues: string[] = [];
        comps.push({
          type: "select",
          name,
          text: String(c?.text || ""),
          selectionType,
          weight,
          items,
          selectedIndex,
          selectedValues,
          eventBinding: c.eventBinding,
        });
        continue;
      }
      if (t === "button") {
        comps.push({ type: "button", name, text: String(c?.text || ""), weight, eventBinding: c.eventBinding });
        continue;
      }
    }
    if (comps.length) out.push({ dir, components: comps });
  }
  return out;
});

const buildArgs = (args: any[], eventValue: any) => {
  const out: any[] = [];
  for (const a of args || []) {
    if (a === "$event.value") out.push(eventValue);
    else out.push(a);
  }
  return out;
};

const trigger = async (c: { eventBinding?: Record<string, RawBinding[]> }, eventType: string, value?: any) => {
  const bindings = c.eventBinding?.[eventType];
  const b = Array.isArray(bindings) ? bindings[0] : null;
  if (!b || b.type !== "deviceAction") return;
  const actionName = String(b.params?.actionName || "");
  if (!actionName) return;
  const args = buildArgs(b.params?.args || [], value);
  await hc3.runDeviceAction(() => hc3.ensureClient().callAction(Number(props.deviceId), actionName, args));
};

const onPickSingle = (c: any, e: any) => {
  const idx = Number(e.detail.value ?? 0);
  const item = c.items[idx];
  if (!item) return;
  trigger(c, "onToggled", item.value).catch(() => {});
};

const onPickMulti = (c: any, e: any) => {
  const vs = (e?.detail?.value || []).map((x: any) => String(x));
  trigger(c, "onToggled", vs).catch(() => {});
};

const pressTimer = ref<number | null>(null);
const longPressed = ref(false);

const onBtnTouchStart = (c: any, _e: any) => {
  longPressed.value = false;
  if (pressTimer.value != null) clearTimeout(pressTimer.value);
  pressTimer.value = setTimeout(() => {
    longPressed.value = true;
    trigger(c, "onLongPressDown").catch(() => {});
  }, 450) as unknown as number;
};

const onBtnTouchEnd = (c: any, _e: any) => {
  if (pressTimer.value != null) {
    clearTimeout(pressTimer.value);
    pressTimer.value = null;
  }
  if (longPressed.value) {
    trigger(c, "onLongPressReleased").catch(() => {});
    longPressed.value = false;
    return;
  }
  trigger(c, "onReleased").catch(() => {});
};

const onBtnTouchCancel = (_c: any, _e: any) => {
  if (pressTimer.value != null) {
    clearTimeout(pressTimer.value);
    pressTimer.value = null;
  }
  longPressed.value = false;
};
</script>

<style scoped lang="scss">
.root {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.row {
  display: flex;
  gap: 16rpx;
}
.row.h {
  flex-direction: row;
}
.row.v {
  flex-direction: column;
}
.label {
  font-size: 26rpx;
  color: #111;
}
.picker {
  font-size: 26rpx;
  color: #007aff;
}
.select {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.cb {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 0;
}
.cb-text {
  font-size: 24rpx;
  color: #333;
}
.space {
  min-height: 1rpx;
}
.btn {
  display: flex;
}
.empty {
  padding: 12rpx 0;
  color: #666;
  font-size: 24rpx;
}
</style>
