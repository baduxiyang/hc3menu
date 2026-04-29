<template>
  <view class="root" v-if="rows.length">
    <view class="row" v-for="(row, idx) in rows" :key="idx" :class="row.dir">
      <template v-for="c in row.components" :key="c.name">
        <view v-if="c.type === 'space'" class="space" :style="weightStyle(c.weight)"></view>

        <view v-else-if="c.type === 'label'" class="label" :style="weightStyle(c.weight)">
          <text>{{ c.text }}</text>
        </view>

        <view v-else-if="c.type === 'select' && c.selectionType === 'single'" class="select" :style="weightStyle(c.weight)">
          <view class="select-row" @click="openSelect(c)">
            <text class="select-left">{{ c.text || c.name }}</text>
            <text class="select-right">{{ c.items[c.selectedIndex]?.label || "请选择" }}</text>
          </view>
        </view>

        <view v-else-if="c.type === 'select' && c.selectionType === 'multi'" class="select" :style="weightStyle(c.weight)">
          <view class="select-row" @click="openSelect(c)">
            <text class="select-left">{{ c.text || c.name }}</text>
            <text class="select-right">{{ multiSummary(c) }}</text>
          </view>
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

    <view v-if="multiModalVisible" class="mask" @click="closeMultiModal">
      <view class="sheet" @click.stop>
        <view class="sheet-title">
          <text>{{ multiModalTitle }}</text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <label class="sheet-item" v-for="it in multiModalItems" :key="it.value">
            <checkbox
              :value="String(it.value)"
              :checked="multiModalSelected[String(it.value)] === true"
              @click.stop="toggleMulti(it.value)"
            />
            <text class="sheet-text">{{ it.label }}</text>
          </label>
        </scroll-view>
        <view class="sheet-actions">
          <button size="mini" @click="closeMultiModal">取消</button>
          <button size="mini" @click="confirmMulti">确定</button>
        </view>
      </view>
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

const selectState = ref<Record<string, { selectedIndex: number; selectedValues: string[] }>>({});

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
        const st = selectState.value[name];
        const selectedIndex = st?.selectedIndex ?? 0;
        const selectedValues: string[] = Array.isArray(st?.selectedValues) ? st!.selectedValues : [];
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

const multiSummary = (c: any) => {
  const n = (c.selectedValues || []).length;
  if (!n) return "请选择";
  if (n === 1) {
    const v = String(c.selectedValues[0]);
    const it = (c.items || []).find((x: any) => String(x.value) === v);
    return it?.label || "已选择 1 项";
  }
  return `已选择 ${n} 项`;
};

const multiModalVisible = ref(false);
const multiModalComp = ref<any | null>(null);
const multiModalItems = ref<SelectItem[]>([]);
const multiModalSelected = ref<Record<string, boolean>>({});
const multiModalTitle = computed(() => multiModalComp.value?.text || multiModalComp.value?.name || "请选择");

const closeMultiModal = () => {
  multiModalVisible.value = false;
  multiModalComp.value = null;
  multiModalItems.value = [];
  multiModalSelected.value = {};
};

const toggleMulti = (v: any) => {
  const key = String(v);
  multiModalSelected.value = { ...multiModalSelected.value, [key]: !multiModalSelected.value[key] };
};

const confirmMulti = () => {
  const c = multiModalComp.value;
  if (!c) return;
  const vs = Object.keys(multiModalSelected.value).filter((k) => multiModalSelected.value[k] === true);
  selectState.value = { ...selectState.value, [c.name]: { selectedIndex: c.selectedIndex ?? 0, selectedValues: vs } };
  closeMultiModal();
  trigger(c, "onToggled", vs).catch(() => {});
};

const openSelect = (c: any) => {
  if (c.selectionType === "single") {
    const itemList = (c.items || []).map((x: any) => String(x.label || ""));
    if (!itemList.length) return;
    uni.showActionSheet({
      itemList,
      success: (res: any) => {
        const idx = Number(res.tapIndex ?? -1);
        const item = c.items[idx];
        if (!item) return;
        selectState.value = { ...selectState.value, [c.name]: { selectedIndex: idx, selectedValues: [String(item.value)] } };
        trigger(c, "onToggled", item.value).catch(() => {});
      },
    });
    return;
  }

  const selected: Record<string, boolean> = {};
  for (const v of c.selectedValues || []) selected[String(v)] = true;
  multiModalComp.value = c;
  multiModalItems.value = c.items || [];
  multiModalSelected.value = selected;
  multiModalVisible.value = true;
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
.select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 18rpx;
  border-radius: 12rpx;
  background: #f0f2f6;
  gap: 20rpx;
}
.select-left {
  font-size: 26rpx;
  color: #111;
}
.select-right {
  font-size: 26rpx;
  color: #007aff;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360rpx;
}
.space {
  min-height: 1rpx;
}
.btn {
  display: flex;
}
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}
.sheet {
  width: 100%;
  background: #fff;
  border-top-left-radius: 20rpx;
  border-top-right-radius: 20rpx;
  padding: 20rpx;
  box-sizing: border-box;
}
.sheet-title {
  font-size: 28rpx;
  color: #111;
  padding: 8rpx 4rpx 16rpx;
}
.sheet-body {
  max-height: 60vh;
}
.sheet-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 6rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.sheet-text {
  font-size: 26rpx;
  color: #333;
}
.sheet-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding-top: 16rpx;
}
.empty {
  padding: 12rpx 0;
  color: #666;
  font-size: 24rpx;
}
</style>
