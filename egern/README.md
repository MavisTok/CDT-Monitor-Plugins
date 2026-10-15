# CDT Monitor · Egern

[项目首页](../README.md) · [完整配置字段](../surge/README.md#在模块参数表编辑)

使用 Egern 官方 **原生 `export default async function(ctx)` API**，不是旧版 Surge 兼容脚本。请使用支持 `ctx.http`、`ctx.storage`、`ctx.notify`、`env_schema` 和 Widget DSL 的当前版本；官方页面未列出这些接口的统一最低版本。

## 安装与首次查询

在模块管理中导入：

```text
https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/egern/CDT-Monitor.yaml
```

1. 在模块环境变量表单保留 `config_source=module`。
2. 填写 `access_key_id`、`access_key_secret`、`region_id` 和实际 `max_traffic_gib`。
3. 仅查流量无需实例 ID；其他未使用项保留默认值。保存后手动运行 **CDT-Refresh**。
4. 可使用模块中的 `CDT-Refresh` Widget。Widget 只查询并展示，不触发自动启停。

**普通用户不运行 CDT-Setup**。没有高级 JSON 时 Setup 会给出操作引导，不导入配置。模块包含中文描述、参数标题和说明。脚本默认环境变量提供实际默认值，环境变量表单中的 placeholder 不是已保存配置。

## 脚本用途

| 名称 | 功能 |
| --- | --- |
| CDT-Refresh | 手动查询流量、状态和可选账单；Widget 的只读入口 |
| CDT-Monitor | 每10分钟的 schedule：执行查询、已启用的策略、日报及通知重试 |
| CDT-History | 输出历史与操作日志 JSON 到脚本日志 |
| CDT-Notify-Test | 测试系统、Telegram、Webhook 已启用通道 |
| CDT-Start / CDT-Stop | 仅手动运行的 Generic 控制入口，勿配置为 Widget |
| CDT-Setup | 仅手动导入高级 config_json |

手动控制先填写 `allow_control=true`、`control_account` 和 `control_confirm`。账号需匹配记录 ID，确认值需精确匹配完整实例 ID，然后明确运行对应 Generic 项。Widget 或 schedule 上下文不会执行手动控制。`ctx.script.name` 用于识别入口，请保留脚本名称。

自动策略字段与其他平台一致：`threshold_action=stop`、`schedule_enabled=true`、`keep_alive=true` 等均需控制总开关及实例 ID。CDT 是账号分类用量，默认只读。流量或状态查询失败时不启停；手动停机暂停后续自动启动，显式启动才能解除暂停。控制超时保留不确定状态及冷却。

## 多账号与通知

填写 [config.example.json](../config.example.json) 格式的完整 JSON 到 `config_json`，手动运行 CDT-Setup；成功后将 `config_source` 改为 `local`。后续修改同样重新导入。导入验证失败或运行锁占用时不覆盖配置。

Telegram 与 Webhook 在表单启用并填入接收信息，使用 CDT-Notify-Test 检查。HTTP 超时转换为毫秒，禁用 Cookie 和重定向，验证 HTTPS 证书。

配置及历史保存在 Egern 中，不从其他应用自动同步。定时运行依赖应用、网络和系统调度。不要在多台设备同时控制同一实例。

## 安装与开发验证

模块是 JSON 兼容 YAML，Egern 可按 YAML 解析。未发布测试时可把 JS 放到本地，复制模块并修改 `script_url`。在 iOS 实机验证模块导入、环境变量保存、Refresh Widget、通知以及至少一个定时周期；真实启停需使用自己明确选择的实例。

依据：[模块](https://egernapp.com/docs/configuration/modules)、[环境变量](https://egernapp.com/docs/configuration/env)、[脚本 API](https://egernapp.com/docs/javascript-api)。
