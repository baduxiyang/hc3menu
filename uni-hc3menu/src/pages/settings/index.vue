<script setup lang="ts">
import { computed, ref } from "vue"
import { useHc3Store } from "../../stores/hc3"
import { useSettingsStore } from "../../stores/settings"

const hc3 = useHc3Store()
const settings = useSettingsStore()

const form = ref({
  host: settings.creds.host,
  port: settings.creds.port,
  https: settings.creds.https,
  user: settings.creds.user,
  password: settings.creds.password,
  pin: settings.creds.pin || "",
})

const favorites = computed(() => settings.favorites)
const favoriteDevices = computed(() => favorites.value.map((id) => hc3.devices[Number(id)]).filter(Boolean))

async function saveAndConnect() {
  settings.setCreds({
    host: form.value.host.trim(),
    port: Number(form.value.port || 80),
    https: Boolean(form.value.https),
    user: form.value.user.trim(),
    password: form.value.password,
    pin: String(form.value.pin || "").trim(),
  })
  await settings.save()
  await hc3.connect(settings.creds)
}

function moveFav(id: number, dir: -1 | 1) {
  const ids = [...settings.favorites]
  const idx = ids.indexOf(Number(id))
  if (idx < 0) return
  const j = idx + dir
  if (j < 0 || j >= ids.length) return
  const tmp = ids[idx]
  ids[idx] = ids[j]
  ids[j] = tmp
  settings.setFavorites(ids)
  settings.save()
}

function removeFav(id: number) {
  const ids = settings.favorites.filter((x) => Number(x) !== Number(id))
  settings.setFavorites(ids)
  settings.save()
}

function addRule() {
  settings.notifications.push({
    device_id: 0,
    property: "value",
    condition: "any",
    message: "{name} {property} -> {newValue}",
  })
}

function removeRule(i: number) {
  settings.notifications.splice(i, 1)
}

async function saveSettingsOnly() {
  await settings.save()
  uni.showToast({ title: "已保存", icon: "none" })
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="title">连接</view>
      <view class="muted" style="margin-top: 8rpx">HC3 IP/域名建议填局域网地址</view>

      <view style="height: 12rpx" />

      <view class="row">
        <view style="width: 160rpx" class="muted">Host</view>
        <input v-model="form.host" placeholder="192.168.1.50" />
      </view>
      <view class="row">
        <view style="width: 160rpx" class="muted">Port</view>
        <input v-model="form.port" type="number" placeholder="80" />
      </view>
      <view class="row">
        <view style="width: 160rpx" class="muted">HTTPS</view>
        <switch v-model="form.https" />
      </view>
      <view class="row">
        <view style="width: 160rpx" class="muted">User</view>
        <input v-model="form.user" placeholder="hc3 user" />
      </view>
      <view class="row">
        <view style="width: 160rpx" class="muted">Password</view>
        <input v-model="form.password" password placeholder="hc3 password" />
      </view>
      <view class="row">
        <view style="width: 160rpx" class="muted">PIN(可选)</view>
        <input v-model="form.pin" placeholder="4位PIN" />
      </view>

      <view style="height: 16rpx" />

      <view class="row" style="justify-content: flex-start; gap: 16rpx">
        <button type="primary" @click="saveAndConnect">保存并连接</button>
        <button @click="hc3.refreshNow()">手动刷新</button>
      </view>

      <view style="height: 10rpx" />

      <view class="muted">
        <text v-if="hc3.connected">状态：已连接</text>
        <text v-else>状态：未连接（{{ hc3.lastError || "无" }}）</text>
      </view>
    </view>

    <view style="height: 18rpx" />

    <view class="card">
      <view class="title">同步/轮询</view>
      <view class="row">
        <view style="width: 240rpx" class="muted">poll_timeout_sec</view>
        <input v-model.number="settings.poll_timeout_sec" type="number" />
      </view>
      <view class="row">
        <view style="width: 240rpx" class="muted">关注通知</view>
        <switch v-model="settings.attention_notifications" />
      </view>
      <view class="row">
        <view style="width: 240rpx" class="muted">低电量阈值</view>
        <input v-model.number="settings.low_battery_threshold" type="number" />
      </view>
      <view class="row">
        <view style="width: 240rpx" class="muted">QA错误通知</view>
        <switch v-model="settings.qa_error_notifications" />
      </view>
      <view class="row">
        <view style="width: 240rpx" class="muted">QA节流(秒)</view>
        <input v-model.number="settings.qa_error_throttle_sec" type="number" />
      </view>
      <view style="height: 12rpx" />
      <button @click="saveSettingsOnly">保存设置</button>
    </view>

    <view style="height: 18rpx" />

    <view class="card">
      <view class="row">
        <view class="title">收藏</view>
        <view class="muted">{{ favorites.length }}</view>
      </view>
      <view v-if="favorites.length === 0" class="muted" style="margin-top: 10rpx">从设备列表点 ☆ 添加</view>
      <view v-for="d in favoriteDevices" :key="d.id" class="fav-row">
        <view>
          <view>{{ d.name || ("Device " + d.id) }}</view>
          <view class="muted">id={{ d.id }}</view>
        </view>
        <view class="row" style="justify-content: flex-end; gap: 12rpx">
          <button size="mini" @click="moveFav(Number(d.id), -1)">↑</button>
          <button size="mini" @click="moveFav(Number(d.id), 1)">↓</button>
          <button size="mini" @click="removeFav(Number(d.id))">移除</button>
        </view>
      </view>
    </view>

    <view style="height: 18rpx" />

    <view class="card">
      <view class="row">
        <view class="title">通知规则</view>
        <button size="mini" @click="addRule">添加</button>
      </view>
      <view class="muted" style="margin-top: 10rpx">device_id=0 的规则不会触发</view>
      <view v-for="(r, i) in settings.notifications" :key="i" class="rule">
        <view class="row">
          <view style="width: 180rpx" class="muted">device_id</view>
          <input v-model.number="r.device_id" type="number" />
        </view>
        <view class="row">
          <view style="width: 180rpx" class="muted">property</view>
          <input v-model="r.property" />
        </view>
        <view class="row">
          <view style="width: 180rpx" class="muted">condition</view>
          <input v-model="r.condition" placeholder="any/true/false/>X/<X/==X" />
        </view>
        <view class="row">
          <view style="width: 180rpx" class="muted">message</view>
          <input v-model="r.message" placeholder="{name} {property} -> {newValue}" />
        </view>
        <view style="height: 10rpx" />
        <view class="row" style="justify-content: flex-end">
          <button size="mini" @click="removeRule(i)">删除</button>
        </view>
        <view style="height: 10rpx" />
      </view>
      <button style="margin-top: 12rpx" @click="saveSettingsOnly">保存规则</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.fav-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eee;
}
.rule {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #eee;
}
</style>

