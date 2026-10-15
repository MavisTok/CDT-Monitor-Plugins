# CDT Monitor：Surge 模块

[返回项目首页](../README.md) · [Loon 插件](../loon/README.md)

## v0.5.0 仓库更名与目录迁移

本平台的模块、脚本和安装说明已移到 `surge/`。旧根目录安装来源需要一次性改为下面的新地址，保留已有参数后更新并应用。开发命令在仓库根目录执行。

直接从 Surge 调用阿里云 CDT、ECS、BSS HTTPS API。无需安装 CDT-Monitor 后台、Docker、Node 服务或 SQLite。Node 仅用于开发构建和测试；使用生成的模块和脚本无需安装任何开发依赖。

本项目移植自 [wang4386/CDT-Monitor](https://github.com/wang4386/CDT-Monitor) 的阿里云调用和监控策略，保留 MIT 许可。这是独立的 Surge 实现，不是原作者正式发布的 Surge 客户端。

首次安装请先阅读 [安装说明](安装说明.md)，其中有 Mac 和 iPhone 的逐步操作及首次参数填写表。

## 通过 URL 快速安装

**v0.5.0：仓库统一为 CDT-Monitor-Plugins。首次在 Surge 的模块管理页选择“从 URL 安装”；以后在原模块中点“更新模块”。旧仓库或根目录来源需改为下列新地址。** Surge 自动下载并缓存脚本，无需手动复制 JS。

| 平台 | 模块地址 |
| --- | --- |
| iPhone / iPad | [CDT-Monitor.sgmodule](https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/surge/CDT-Monitor.sgmodule) |
| Mac | [CDT-Monitor-Mac.sgmodule](https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/surge/CDT-Monitor-Mac.sgmodule) |

**iOS：**

```text
https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/surge/CDT-Monitor.sgmodule
```

**Mac：**

```text
https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/surge/CDT-Monitor-Mac.sgmodule
```

1. 从上面的 URL 安装对应模块，打开模块参数表，保留 `config_source=module`。
2. 填写 `access_key_id`、`access_key_secret`、`region_id`、`instance_id` 和实际额度 `max_traffic_gib`。只查看流量时，`instance_id` 保留“未设置”。
3. 启用并保存模块，确保脚本功能已开启，刷新 **CDT Monitor** 面板。
4. 以后直接在模块参数表修改设置，下一次执行生效。默认只读，每 10 分钟查询一次。

**只启用一份 CDT 模块。** GitHub 仅分发公开代码，监控计算和数据存储在 Surge 本地完成；查询直接请求阿里云，可选通知请求你配置的 Telegram / Webhook。不要把 AccessKey、Token 或已填写的配置提交到仓库、安装 URL 或 Issue。首次下载和更新需能访问 `raw.githubusercontent.com`，无需部署后台或启用 MITM。

完整模块需 Surge iOS 5.9.0+ 或 Mac 5.7.5+。Mac 参数表从 5.5.0 起可用，面板需 5.7.5。[官方模块参数说明](https://manual.nssurge.com/profile/module.html)、[面板版本要求](https://manual.nssurge.com/tools/panel.html)、[iOS 更新记录](https://kb.nssurge.com/surge-knowledge-base/release-notes/surge-ios)

[安装说明](安装说明.md) 包含分步操作、可复制的 Surge URL Scheme、首次参数填写表和下载失败处理。

### 更新与旧版迁移

安装入口使用新仓库的 `/refs/heads/main/surge/`，模块内 JS 固定到配套发布标签（本版为 `v0.5.0`）；更新模块会同时获取新版脚本引用。模块名称、参数字段和数据 key 保持兼容。旧来源先保留参数，修改来源后检查并应用；若客户端只能重新安装，填回原参数。

**如果以前按聊天或旧 Release 说明使用了 `/v0.3.1/`、`/v0.3.2/` 等地址：这些地址固定在旧版本，“更新模块”仍只会下载那个版本。需要一次性把安装来源换成上面的持续更新地址。** 先保留已填写参数；若 Surge 当前版本提供修改来源 URL 的入口，可在原模块中修改。若没有该入口，需要停用旧模块、从持续更新地址安装一次并填回参数。后续不再按版本号重新安装，只启用一份 CDT 模块。仓库更新无法自动更换手机上已保存的安装来源。

更新后暂时仍显示旧版本时，可能是 GitHub Raw 的短时缓存。稍候再次点原模块的“更新模块”，不用删除模块、添加随机 URL 参数或改用版本标签。脚本下载失败时，在外部资源管理中重试。

[INSTALL-URLS.txt](../INSTALL-URLS.txt) 与发布说明统一由构建工具生成持续更新入口。历史标签和 ZIP 仅供固定版本留存或回滚，不作为日常更新入口。

从 v0.1.0 / v0.2.0 本地模块迁移：先自行留存已有参数，停用旧模块，再从 URL 安装并填回参数；不要同时启用远程与本地版。已有多账号配置的用户将 `config_source` 改为 `local` 即可继续使用原配置和历史。参数表模式仍使用原有持久化 key；同一台设备保留配置来源和 `account_id` 时可继续使用原历史。两种配置来源使用独立配置/历史 key，切换不会覆盖另一种来源的数据。

### 下载文件安装

不能访问 GitHub Raw 时，从 [标签页](https://github.com/MavisTok/CDT-Monitor-Plugins/tags) 下载对应版本 ZIP；使用 `CDT-Monitor-Local.sgmodule`（iOS）或 `CDT-Monitor-Local-Mac.sgmodule`（Mac），同时将 `cdt-monitor.js`、`cdt-setup.js` 放到 Surge **主配置所在目录**。这两份模块只引用本地文件。详见 [本地安装步骤](安装说明.md#八-本地文件安装备用)。

| 文件 | 用途 |
| --- | --- |
| `CDT-Monitor.sgmodule` | iOS URL 安装，定时任务带 `wake-system=true` |
| `CDT-Monitor-Mac.sgmodule` | Mac URL 安装 |
| `CDT-Monitor-Local.sgmodule` | iOS 本地文件安装，相对脚本路径 |
| `CDT-Monitor-Local-Mac.sgmodule` | Mac 本地文件安装，相对脚本路径 |
| `cdt-monitor.js` | 已打包的无依赖监控脚本 |
| `cdt-setup.js` | 可选：高级多账号配置导入脚本；普通安装无需运行 |
| `config.example.json` | 高级配置字段示例，含占位值 |

## 在模块参数表编辑

这是 Surge 原生参数表，值以文本填写，开关使用小写 `true` / `false`。字段名为英文，完整对照见下方；无需将整个配置粘贴成 JSON。普通模式一次管理一条账号/实例记录；多账号及自定义多个 Webhook 请求头使用 `config_source=local`。

<!-- MODULE_PARAMETER_TABLE_START -->

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `config_source` | `module` | module：使用本表；local：使用原本地多账号配置 |
| `account_id` | `ecs-1` | 稳定且唯一的记录 ID |
| `account_name` | `ECS` | 面板显示名称 |
| `access_key_id` | `未设置` | RAM AccessKey ID |
| `access_key_secret` | `未设置` | RAM AccessKey Secret |
| `region_id` | `cn-hongkong` | 实例地域 |
| `instance_id` | `未设置` | 完整 ECS 实例 ID；未设置则仅查流量 |
| `site_type` | `china` | china 中国站 / international 国际站 |
| `max_traffic_gib` | `200` | 账号分类额度，单位 GiB，请按实际额度修改 |
| `threshold_percent` | `95` | 告警阈值百分比 |
| `allow_control` | `false` | 实例控制总开关 true / false |
| `threshold_action` | `notify` | notify 仅通知 / stop 停机并通知 |
| `shutdown_mode` | `KeepCharging` | KeepCharging 普通停机 / StopCharging 节省停机 |
| `keep_alive` | `false` | 实例保活 true / false |
| `schedule_enabled` | `false` | 定时启停 true / false |
| `start_time` | `08:00` | 定时启动 HH:mm |
| `stop_time` | `23:00` | 定时停止 HH:mm |
| `billing` | `false` | 余额与账单查询 true / false |
| `daily_report_time` | `21:00` | 日报 HH:mm；填写关闭可停用日报 |
| `timezone_offset_minutes` | `480` | 业务时区相对 UTC 的分钟偏移 |
| `request_timeout_seconds` | `10` | 请求超时 3–15 秒 |
| `system_notification` | `true` | 系统通知 true / false |
| `telegram_enabled` | `false` | Telegram 通知 true / false |
| `telegram_base_url` | `https://api.telegram.org` | Telegram HTTPS API 或反代地址 |
| `telegram_bot_token` | `未设置` | Telegram Bot Token |
| `telegram_chat_id` | `未设置` | Telegram 接收者 Chat ID |
| `webhook_enabled` | `false` | Webhook 通知 true / false |
| `webhook_url` | `未设置` | Webhook HTTPS 地址 |
| `webhook_authorization` | `未设置` | Webhook Authorization 请求头；无需认证时保留未设置 |

<!-- MODULE_PARAMETER_TABLE_END -->

**首次安装：把 `access_key_id` 和 `access_key_secret` 的“未设置”替换为自己的 RAM 密钥。未使用的实例、Telegram 和 Webhook 选项保留“未设置”，不要直接清空输入框。** 这是空值的保留写法，脚本会将它还原为空；Surge 因而能完成所有参数替换。未填写任一密钥时，面板提示“尚未配置”，不请求阿里云、不使用旧密钥缓存。关闭日报请将 `daily_report_time` 填为“关闭”；高级 JSON 模式仍使用空字符串。

参数值支持中文、空格、逗号、`&`、`+`、`=` 和字面百分号，无需 URL 编码。由于 Surge 采用文本替换，值中不要使用竖线 `|`、英文双引号或换行；特殊配置可使用高级本地 JSON 模式。

保存参数后，新配置在下一次脚本执行时生效；已经发出的实例控制请求不能撤回。脚本会校验布尔值、数值、时间和凭据格式；校验失败时本轮不发起请求，也不使用上次缓存的控制配置。有效的新参数会在取得运行锁后保存快照，并备份上一份模块参数。快照用于运行检查，不是参数来源；要修改普通模式配置，请编辑模块参数表。

开启阈值停机：在表中设置 `allow_control=true`、`threshold_action=stop`，填入完整 `instance_id`，保存。若开启 `schedule_enabled` 或 `keep_alive`，同样需要打开控制总开关。`threshold_percent` 只决定触发比例，不改变流量额度。

如果你使用的是 Surge 的持久化“数据编辑器”，可将 `config_source` 设置为 `local`，直接编辑 key `cdt.local.config.v1` 中的完整 JSON；字段结构见 `config.example.json`。保存后下一次执行会重新校验，不需要再次导入 Setup。不要编辑 `module-config` 快照来修改参数表模式。

## 已实现功能

- 1–8 条账号/实例记录；相同凭据的 CDT 查询在一轮内合并。
- 国内/海外 CDT 用量、额度、使用比例、阈值通知。
- ECS 精确实例状态查询；可选手动启动/停止、阈值停机、每日定时启停、实例保活。
- 查询失败保留缓存并明确显示错误；任何自动/手动实例控制都要求本轮成功取得流量和精确实例状态。
- 本机系统通知；可选 Telegram、JSON Webhook；失败的外部通知保存到本地队列，下轮重试。
- 指定时间的流量状态日报；保存最近 720 个小时快照、180 个日快照和每条记录最近 100 条操作日志。
- 可选余额、月度实例账单查询，缓存 6 小时；账单通过 `NextToken` 翻页，最多 10 页；不完整结果不会覆盖旧金额。
- 普通停机 `KeepCharging`、节省停机 `StopCharging`。是否支持节省停机由阿里云实例实际条件决定；模块不发送强制停机参数。

## 流量口径

CDT 查询沿用原项目的 `ListCdtInternetTraffic`，按 `BusinessRegionId` 汇总：`cn-*` 且不是 `cn-hongkong` 归国内，其余归海外。**这是阿里云账号的分类汇总，不是每台 ECS 的独立用量。** 同一账号下的多台海外实例会显示同一海外总量，达到阈值时每条启用停机策略的实例记录都可能被停止。

用量单位是 GiB（字节除以 1024³）；`maxTrafficGiB` 请按照自己的实际额度填写，示例的 200 不是对你账号免费额度的判断。查询结果来自阿里云，可能延迟；Surge 的本机代理流量不参与计算。CDT 缺字段、空明细、异常数值均视为查询失败，不能作为零用量开启实例。

历史是采样时的累计用量，按小时/日保留最新一次快照，不是独立查询出来的每日账单；月度重置可在 `cycle` 字段区分。日报发送当前累计流量和状态，不推算缺失时段的精确消耗。

## 高级本地 JSON 配置

将模块参数 `config_source` 设为 `local`，在 Surge 持久化数据编辑器中将完整 JSON 保存到 `cdt.local.config.v1`；或通过快捷指令运行模块内的 `CDT-Setup`，将完整配置 JSON 文本作为输入参数传入。远程版无需修改下载的 JS；直接运行未传入配置的 Setup 会因占位值无效而拒绝保存。使用本地文件版时，也可以只在自己设备上编辑 `cdt-setup.js` 开头的 `LOCAL_CONFIG` 再运行 Setup。完整示例见 `config.example.json`，填写真实值后仅保存在本地，支持 1–8 条记录。该模式下参数表里的单账号设置不参与合并或覆盖。

| 字段 | 含义 |
| --- | --- |
| `timezoneOffsetMinutes` | 业务固定 UTC 偏移，默认 480（北京时间），不支持自动夏令时 |
| `requestTimeoutSeconds` | 每个 HTTP 请求超时，3–15 秒，默认 10 |
| `allowControl` | 控制总开关，默认 `false` |
| `dailyReportTime` | 每日状态汇总时间 `HH:mm`；空字符串关闭 |
| `accounts[].id` | 唯一稳定标识，供快捷指令选择账号；不要随意改名 |
| `accounts[].enabled` | 是否启用该条记录 |
| `accessKeyId/accessKeySecret` | 阿里云 RAM 凭据，仅在本地填写 |
| `regionId` | 如 `cn-hongkong`、`ap-southeast-1` |
| `instanceId` | ECS 完整实例 ID；为空时只监控分类流量，不查询/控制 ECS |
| `siteType` | `china` 中国站，`international` 国际站；影响 BSS 端点，与流量国内/海外分类无关 |
| `maxTrafficGiB` | 你自行配置的分类额度，大于 0 |
| `thresholdPercent` | 默认 95；达到该比例触发阈值告警 |
| `thresholdAction` | `notify` 仅通知，`stop` 通知并尝试停机 |
| `shutdownMode` | `KeepCharging` 或 `StopCharging` |
| `keepAlive` | 在低于阈值、允许的运行时段内，发现 Stopped 后尝试启动 |
| `billing` | 是否查询余额和实例账单；默认关闭 |
| `schedule.enabled/start/stop` | 定时启停开关和 HH:mm；支持跨午夜，两个时间至少相隔 15 分钟 |

通过 Setup 修改时会先校验并备份原配置；通过 Surge 数据编辑器直接修改时，下一次执行才校验，编辑器自己的保存过程不由本脚本控制，请保留原 JSON。定时、保活和阈值停机需要 `allowControl=true` 和完整实例 ID。

## 查询与手动控制

面板点击只刷新展示，不触发自动策略或通知。`CDT-Monitor` 负责自动策略；`CDT-Refresh` 只查询；`CDT-Notify-Test` 测试通知；`CDT-History` 将历史 JSON 输出到脚本日志及 `$done().result`。

在快捷指令中选择运行 `CDT-Control`，传入 JSON 文本：

```json
{"op":"stop","account":"ecs-1","confirm":"i-你的完整实例ID"}
```

启动将 `op` 改为 `start`。也可传入 `op=stop&account=ecs-1&confirm=i-完整实例ID`。`account` 对应配置的 `id`，`confirm` 必须精确匹配实例 ID。仅显式快捷指令、脚本编辑器或本地 Surge HTTP API 调用允许手动控制，面板输入强制按只读查询处理。

手动停机后设置本地暂停标记，**定时启动和保活不会自动把实例重新启动**。显式手动启动会清除此标记，但仍检查流量阈值。已经处于目标状态时不重复发送指令。已达阈值不允许手动/自动启动；需要先解决额度/用量条件。

控制指令发送前保存预留记录。接口返回成功仅表示指令被接受，显示 Starting/Stopping，下一轮才确认实例状态。网络超时可能意味着指令已经被云端执行，保留 `uncertain` 并进入 10 分钟冷却，期间不重复发送。冷却对同一记录所有启停指令生效。单台设备的本地运行锁用于减少重叠；Surge KV 没有数据库事务，不能作为跨设备分布式锁。不要同时在多台设备启用同一实例的自动控制。

## 定时与通知

每 10 分钟检查一次（每小时 6 次），定时启停及日报有 **10 分钟内补偿窗口**，例如 08:03 的计划在正常 08:10 的检查中执行。错过窗口不追补。业务时区来自配置偏移；cron 唤醒频率由设备时钟驱动。

iOS 的 `wake-system=true` 辅助设备闲置时唤醒；手机关机、Surge 停止、系统限制、Mac 睡眠或断网都会导致漏执行。自动停机依赖查询周期、阿里云统计延迟和设备可用性，不能保证刚到额度就停止。[官方定时说明](https://manual.nssurge.com/scripting/cron.html)

阈值通知按记录和月份去重；成功查询低于阈值后重新允许告警。系统通知成功后不因 Webhook 重试而重复发系统通知。外部通道按至少一次方式投递，超时后的重试可能重复，Webhook 中的 `id` 可用于接收端去重。保留最多 30 条队列事件，每轮重试前 5 条，超过上限丢弃最旧事件；面板显示待重试数量。

Telegram 需启用并填写 `baseURL`（默认官方 HTTPS 地址）、`botToken`、`chatId`。支持自己的 HTTPS 反代。Webhook 为 HTTPS POST，可自定义 headers，发送：

```json
{"source":"cdt-monitor-surge","id":"事件ID","title":"标题","body":"正文","at":"ISO时间"}
```

未移植原项目的 SMTP 发信、Web 管理页面、管理员登录、数据库迁移和网页历史图表；它们不是此 Surge 版的运行依赖。需要图表时可从历史 JSON 单独绘图。

## 凭据与权限

参数表模式的 AccessKey 和通知凭据保存在 Surge 模块实例设置中，运行时另以 JSON 保存本地快照/备份；高级模式保存在 `$persistentStore`。**此版本没有承诺硬件密钥库或应用级加密保护**。导出已填写的模块设置或配置脚本时会包含凭据，注意设备备份/同步的范围。脚本日志不输出 AccessKey/Secret、签名正文和原始 API 响应；Surge 自身的请求查看功能仍可能展示脚本参数及签名请求参数。所有接口使用 HTTPS，不启用 MITM，不修改路由规则，不关闭证书验证。

建议独立 RAM 用户。只读模式需 CDT `ListCdtInternetTraffic` 和 ECS `DescribeInstanceStatus` 的权限；启用控制才添加 `StartInstance`、`StopInstance`，在阿里云策略中限制到指定实例。账单可选，官方文档对应权限为 `bssapi:DescribeInstanceBill`；余额需要对应 `QueryAccountBalance` 授权。具体 RAM 权限名称以阿里云控制台为准，不要为了兼容默认授予管理员权限。[ECS 状态接口](https://help.aliyun.com/en/ecs/api-describeinstancestatus)、[账单接口](https://help.aliyun.com/zh/user-center/developer-reference/api-bssopenapi-2017-12-14-describeinstancebill)

高级 JSON 模式使用 `cdt.local.config.v1`、`cdt.local.config.backup.v1`、`cdt.local.state.v1`；模块参数模式使用 `cdt.local.module-config.v1`、`cdt.local.module-config.backup.v1`、`cdt.local.module-state.v1`；两者共用 `cdt.local.lock.v1`。历史/队列中不存 Secret；身份关联字段包含 AccessKey ID、地域、实例 ID。同一个 `id` 改绑凭据/实例时清除该记录的旧运行缓存。删除/禁用记录后，下次查询会移除当前配置来源内该记录的运行历史。

## 开发与验证

```sh
npm run build
npm test
node tools/validate-surge.mjs
```

不需要 `npm install`；没有第三方 npm 依赖。构建从 `package.json` 的仓库和版本字段生成远程地址，并生成无设备绝对路径的本地模块；更换发布仓库或版本后必须重新构建，发布时同时推送 `main` 与匹配的 `v<version>` 标签。安装入口由 `tools/release-info.mjs` 统一定义；用 `npm run release:notes` 生成发布说明，禁止把版本标签模块 URL 当作常规安装地址。修改 `src/core.js`、`src/runtime.js`、`src/setup.js`、`src/module-config.js` 或参数定义 `src/module-parameters.json` 后重新构建生成脚本。构建发现 `cdt-setup.js` 中配置已被编辑时会拒绝覆盖，请将个人配置移到 `cdt-setup.private.js` 并更新模块路径后再构建；该文件名被 Git 忽略。

Node 测试使用 Surge 接口模拟环境和独立 Node crypto 校验，覆盖签名、流量口径、实例匹配、阈值保护、跨午夜补偿、控制超时、配置备份和通知重试。原生验证使用本机 Surge CLI 离线校验临时完整配置，并通过隔离模拟环境执行脚本；不会更改你当前 Surge 配置或调用阿里云。真实账号查询和真实 ECS 启停必须在你填入本地凭据后验证。

参考：[原项目客户端代码](https://github.com/wang4386/CDT-Monitor/blob/main/internal/aliyun/client.go)、[Surge JavaScript API](https://manual.nssurge.com/scripting/api.html)、[Surge Panel](https://manual.nssurge.com/tools/panel.html)、[Surge 模块](https://manual.nssurge.com/profile/module.html)。
