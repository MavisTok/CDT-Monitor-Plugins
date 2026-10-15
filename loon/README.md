# CDT Monitor · Loon

[项目首页](../README.md) · [Surge 版](../surge/README.md)

要求 **Loon 3.5.1 (983)+**，使用官方新版 Script 语法和插件对象参数。查询、通知、账单、历史、阈值停机、定时启停、保活与 Surge 共用核心。

## 安装

在 Loon 的插件管理中添加：

```text
https://raw.githubusercontent.com/MavisTok/CDT-Monitor_Surge_module/refs/heads/main/loon/CDT-Monitor.plugin
```

该入口及内部 `v0.4.0/loon/` 脚本需维护者发布后才可下载。测试未发布代码时，将本目录两个 JS 放到 Loon 可访问的本地脚本目录，复制插件并将两个远程脚本 URL 替换为对应本地路径，再导入本地插件。

1. 打开插件参数，保留 `config_source=module`。
2. 填写 `access_key_id`、`access_key_secret`、`region_id`、`max_traffic_gib`；需要实例查询时填写 `instance_id`。
3. 未使用的选项保留“未设置”；开关填写小写 `true` / `false`。保存并重新加载配置。
4. 手动执行 `CDT-Refresh`，查看返回内容或脚本日志。自动任务每 10 分钟运行一次。

插件不需要 MITM，也不增加路由规则。普通周期查询不逐次发送通知；阈值告警、日报及通知测试按通道配置发送。关闭日报将 `daily_report_time` 填为“关闭”。

## 参数与数据

监控字段与 [共享参数说明](../surge/README.md#在模块参数表编辑) 一致；Loon 使用原生 `[Argument]` 表单，不使用 Surge 的文本占位替换。对象参数可保留中文、竖线、引号和 URL 查询参数。数值和开关按文本输入后由共享校验器验证。

| Loon 专用参数 | 用途 |
| --- | --- |
| `control_account` | 手动启停的账号记录 ID，默认 `ecs-1` |
| `control_confirm` | 手动启停目标的完整 ECS 实例 ID，默认“未设置” |
| `config_json` | 高级多账号完整 JSON，仅 CDT-Setup 读取 |

CDT 是阿里云账号的国内/海外分类汇总，非实例独立用量。额度按实际 GiB 填写。配置、备份、历史在 Loon 本地保存，不会从 Surge 自动迁移。参数模式与高级 JSON 模式使用各自独立的配置和历史；切换来源不合并历史。

## 手动脚本

在 Loon 中选择插件注册的 Generic 脚本运行，保持原来的 Tag：

| 脚本 | 行为 |
| --- | --- |
| `CDT-Refresh` | 查询并展示当前流量、实例、可选账单，不执行自动策略 |
| `CDT-History` | 输出小时、日历史和操作日志 JSON |
| `CDT-Notify-Test` | 测试已启用的通知通道 |
| `CDT-Start` | 显式手动启动指定实例 |
| `CDT-Stop` | 显式手动停止指定实例 |
| `CDT-Setup` | 校验、备份并导入 config_json |
| `CDT-Monitor` | cron 任务：查询、自动策略、日报、通知重试 |

Loon 无 Surge `[Panel]` 面板；结果通过 Generic 返回值和脚本日志查看。历史 JSON 输出到日志及返回对象的 `result`。

### 手动与自动启停

手动操作先设置 `allow_control=true`、`control_account` 与 `control_confirm`，保存配置后明确运行 `CDT-Start` 或 `CDT-Stop`。实例 ID 必须精确匹配。定时任务和刷新入口不会读取手动确认参数或执行手动操作。

手动停机设置暂停标记，保活与计划启动不再自动开机；显式手动启动才清除此标记。启停前仍需本轮流量及状态查询成功，达到阈值禁止启动，超时结果保留冷却记录。不要把 Start/Stop Generic 项改为 cron 或修改 Tag；Loon 公开 API 没有 Surge `$trigger` 等价字段，本实现按专用 Generic Tag 选择操作，依赖发布插件中的固定触发声明。

阈值停机设置 `threshold_action=stop`；保活设置 `keep_alive=true`；计划启停设置 `schedule_enabled=true` 和 `start_time/stop_time`。以上均需控制总开关与完整实例 ID。默认 10 分钟检查，计划有 10 分钟补偿窗口；设备停止运行、断网或系统限制会漏执行。

## 多账号导入

按 [config.example.json](../config.example.json) 填写完整 JSON，仅保存在自己设备。将 JSON 放入 `config_json`，手动运行 `CDT-Setup`；成功后将 `config_source` 改为 `local` 并保存，再运行刷新。导入会校验并备份旧配置，运行锁存在时拒绝覆盖。

`control_account` 在多账号模式中选择记录 ID。其他单账号参数不覆盖高级配置。需要修改高级配置时重新导入。不要将填入凭据的插件或 Setup 副本公开上传。

## 验证与排错

- 显示“尚未配置”：检查两项密钥及当前 config_source，不能依靠旧配置快照代替缺失参数。
- 查不到实例：确认地域、完整实例 ID 与 RAM 权限；启停权限仅在使用控制时需要。
- 无通知：先运行通知测试，检查系统通知权限或 Telegram/Webhook 配置。
- 下载失败：确认对应 main 文件与版本标签已经发布，并能访问 GitHub Raw。
- 插件导入失败：确认版本达到 3.5.1 (983)，此版采用新版 Script 语法。

开发构建及模拟测试在仓库根目录执行 `npm run build`、`npm test`。模拟测试不等同于设备验证：首次使用请确认插件可导入、参数保存后刷新成功、至少一个 cron 周期执行正常；真实启停只针对你明确选择的实例验证。

官方依据：[插件参数](https://nsloon.app/docs/Plugin/)、[Script 语法](https://nsloon.app/docs/Script/script_v2)、[运行时 API](https://nsloon.app/docs/Script/script_api)。HTTP 超时转换为毫秒，并显式设置 `insecure=false` 验证 TLS 证书。
