<template>
  <scroll-view scroll-y class="page">
    <view class="card">
      <view class="title"><text>Connection</text></view>
      <view class="field">
        <text class="label">Host</text>
        <input class="input" v-model="host" placeholder="192.168.1.50" />
      </view>
      <view class="field">
        <text class="label">Port</text>
        <input class="input" v-model="port" type="number" placeholder="80" />
      </view>
      <view class="field switch">
        <text class="label">HTTPS</text>
        <switch :checked="https" @change="(e: any) => (https = Boolean(e.detail.value))" />
      </view>
      <view class="field">
        <text class="label">User</text>
        <input class="input" v-model="user" placeholder="HC3 user" />
      </view>
      <view class="field">
        <text class="label">Password</text>
        <input class="input" v-model="password" type="password" placeholder="HC3 password" />
      </view>
      <view class="field">
        <text class="label">PIN</text>
        <input class="input" v-model="pin" type="number" placeholder="可选，报警需要" />
      </view>
      <view class="actions">
        <button size="mini" @click="onSave">保存</button>
        <button size="mini" @click="onTest">测试连接</button>
      </view>
    </view>

    <view class="card">
      <view class="title"><text>Sync</text></view>
      <view class="field">
        <text class="label">pollTimeoutSec</text>
        <input class="input" v-model="pollTimeoutSec" type="number" placeholder="35" />
      </view>
      <view class="field switch">
        <text class="label">Attention 通知</text>
        <switch :checked="attentionNotifications" @change="(e: any) => (attentionNotifications = Boolean(e.detail.value))" />
      </view>
      <view class="field">
        <text class="label">lowBatteryThreshold</text>
        <input class="input" v-model="lowBatteryThreshold" type="number" placeholder="20" />
      </view>
      <view class="field switch">
        <text class="label">QA error 通知</text>
        <switch :checked="qaErrorNotifications" @change="(e: any) => (qaErrorNotifications = Boolean(e.detail.value))" />
      </view>
      <view class="field">
        <text class="label">qaErrorThrottleSec</text>
        <input class="input" v-model="qaErrorThrottleSec" type="number" placeholder="60" />
      </view>
      <view class="field switch">
        <text class="label">QA crash 通知</text>
        <switch :checked="qaCrashNotifications" @change="(e: any) => (qaCrashNotifications = Boolean(e.detail.value))" />
      </view>
      <view class="field">
        <text class="label">diagnosticsPollSec</text>
        <input class="input" v-model="diagnosticsPollSec" type="number" placeholder="10" />
      </view>
      <view class="actions">
        <button size="mini" @click="onSaveConfig">保存</button>
      </view>
    </view>

    <view class="footer-space"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useSettingsStore } from "@/stores/settings";
import { useHc3Store } from "@/stores/hc3";

const settings = useSettingsStore();
const hc3 = useHc3Store();

const host = ref("");
const port = ref("80");
const https = ref(false);
const user = ref("");
const password = ref("");
const pin = ref("");

const pollTimeoutSec = ref("35");
const attentionNotifications = ref(true);
const lowBatteryThreshold = ref("20");
const qaErrorNotifications = ref(true);
const qaErrorThrottleSec = ref("60");
const qaCrashNotifications = ref(true);
const diagnosticsPollSec = ref("10");

const hydrate = () => {
  if (!settings.loaded) settings.load();
  host.value = settings.creds.host || "";
  port.value = String(settings.creds.port ?? 80);
  https.value = Boolean(settings.creds.https);
  user.value = settings.creds.user || "";
  password.value = settings.creds.password || "";
  pin.value = settings.creds.pin || "";

  pollTimeoutSec.value = String(settings.config.pollTimeoutSec ?? 35);
  attentionNotifications.value = Boolean(settings.config.attentionNotifications);
  lowBatteryThreshold.value = String(settings.config.lowBatteryThreshold ?? 20);
  qaErrorNotifications.value = Boolean(settings.config.qaErrorNotifications);
  qaErrorThrottleSec.value = String(settings.config.qaErrorThrottleSec ?? 60);
  qaCrashNotifications.value = Boolean(settings.config.qaCrashNotifications);
  diagnosticsPollSec.value = String(settings.config.diagnosticsPollSec ?? 10);
};

onShow(hydrate);

const onSave = async () => {
  settings.saveCreds({
    host: host.value.trim(),
    port: Number(port.value || 80),
    https: Boolean(https.value),
    user: user.value.trim(),
    password: password.value,
    pin: pin.value.trim(),
  });
  uni.showToast({ title: "已保存", icon: "success" });
  await hc3.startSync().catch(() => {});
};

const onSaveConfig = async () => {
  settings.saveConfig({
    pollTimeoutSec: Number(pollTimeoutSec.value || 35),
    attentionNotifications: Boolean(attentionNotifications.value),
    lowBatteryThreshold: Number(lowBatteryThreshold.value || 20),
    qaErrorNotifications: Boolean(qaErrorNotifications.value),
    qaErrorThrottleSec: Number(qaErrorThrottleSec.value || 60),
    qaCrashNotifications: Boolean(qaCrashNotifications.value),
    diagnosticsPollSec: Number(diagnosticsPollSec.value || 10),
  });
  uni.showToast({ title: "已保存", icon: "success" });
  hc3.stopSync();
  await hc3.startSync().catch(() => {});
};

const onTest = async () => {
  await onSave();
  const client = hc3.ensureClient();
  const res = await client.testConnection();
  uni.showToast({ title: res.message, icon: res.ok ? "success" : "none" });
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
.field.switch {
  padding: 20rpx 0;
}
.label {
  font-size: 26rpx;
  color: #333;
  min-width: 260rpx;
}
.input {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  color: #111;
  padding: 10rpx 0;
}
.actions {
  margin-top: 16rpx;
  display: flex;
  gap: 16rpx;
}
.footer-space {
  height: 60rpx;
}
</style>
