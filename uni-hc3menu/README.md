# HC3 Menu (uni-app / Vue3)

本目录是对原仓库 **HC3 Menu（macOS 菜单栏 App）** 的 uni-app（Vue3）移植版：面向手机/多端，以 Fibaro HC3 的 REST API 为数据源，实现设备列表、收藏、场景、报警分区、Profiles、关注(低电量/离线)、Debug messages、Diagnostics、搜索与基础通知规则。

## 与原仓库的对应关系

- 原仓库通过 `GET /api/refreshStates?last=...` **长轮询**同步状态，并在本地缓存设备/房间/分区/场景等
- 本项目复用同样的同步模型：客户端维护 `lastRefresh`，循环调用 `refreshStates`，增量应用到本地状态（Pinia store）

关键实现：
- HC3 API 封装：[hc3.ts](file:///workspace/uni-hc3menu/src/api/hc3.ts)
- 状态与长轮询同步：[hc3.ts](file:///workspace/uni-hc3menu/src/stores/hc3.ts)
- 本地配置（连接信息/收藏/通知规则等）：[settings.ts](file:///workspace/uni-hc3menu/src/stores/settings.ts)

## “所有设备状态同步”的实现说明

### 1) 设备实时状态（多客户端一致）
- **HC3 是唯一真源**：任何一台手机/平板/网页端都从 HC3 获取状态
- 每个客户端独立运行 `refreshStates` 长轮询：
  - 服务端有变更就推送返回（HTTP 长连接）
  - 返回里包含 `last/changes/events`，客户端用 `last` 继续下一轮
- 断线重连：
  - 连续 2 次请求失败标记为 disconnected
  - 采用指数退避（上限 60s）自动恢复

### 2) 用户配置（收藏顺序/通知规则）跨设备同步
当前实现为 **本地存储**（`uni.setStorageSync`），适合单设备使用。

如果要“多设备共享同一套收藏/规则”，推荐两种扩展方式：
- uniCloud（推荐）：登录后把 settings 存到云数据库，多个设备同账号自动同步
- 自建后端：统一鉴权 + 配置存储 +（可选）将 HC3 状态广播给客户端，减少每端轮询

本项目已将配置与状态同步解耦：只需把 `settings` 的 load/save 换成远端实现即可。

## 页面入口

- 设备（收藏/房间）：`pages/home/index`
- 场景：`pages/scenes/index`
- 关注 + 入口页：`pages/attention/index`
- 设置：`pages/settings/index`
- 其它页面：设备详情 / 报警 / Profiles / 活动 / Debug / 诊断 / 搜索

## 运行（H5 验证）

```bash
cd uni-hc3menu
npm install
npm run dev:h5
```

## 注意事项

- 连接模式默认“局域网直连 HC3”：需要设备与 HC3 在同一网络/VPN
- Basic Auth 信息保存在本地存储，建议仅在可信设备使用

