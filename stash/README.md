# CDT Monitor · Stash

[项目首页](../README.md) · [完整配置字段](../surge/README.md#在模块参数表编辑)

使用 Stash 覆写、定时任务与 Tile。**参数表要求 iOS/tvOS 3.7+ 或 macOS 4.4+，官方标为 Beta 功能**；不支持覆写参数的旧版本不可直接使用本安装文件。

## 安装

在覆写管理导入：

```text
https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/stash/CDT-Monitor.stoverride
```

1. 打开覆写参数，保留 `config_source=module`。
2. 填好 AccessKey ID 和 Secret 两项、地域及实际额度；需要查询实例才填实例 ID。
3. 保存并应用，首页 **CDT Monitor** Tile 只读查询。普通用户无需运行 Setup。
4. VPN 连接期间 cron 每10分钟自动监控，按已开启的控制和通知策略执行。

覆写正文使用官方 `${args.key|json}` 传递 JSON 字符串，特殊字符按 JSON 转义。参数表和覆写描述都有中文操作说明。没有新增规则或 MITM 配置。

## 手动操作：脚本编辑器

Stash 没有这里假定的 Generic 配置字段，因此不会将控制脚本注册成自动执行的 Tile。覆写声明了脚本 provider，手动操作需从脚本管理/编辑器选择对应名称，设置运行参数；**编辑器不会自动继承覆写参数表**。

先使用下面的高级本地配置导入，再在编辑器运行其他操作：

1. 打开 `CDT-Setup` provider 对应脚本，运行参数设为 `{"config_json":"完整JSON的字符串"}`。将你的配置对象用 `JSON.stringify({config_json: JSON.stringify(config)})` 生成参数，避免手工漏转义。`config` 结构见 [示例](../config.example.json)。
2. 导入成功后，覆写的 `config_source` 设为 `local`，保存应用；Tile 和 cron 使用导入的配置。
3. 其他手动脚本运行参数使用 `{"config_source":"local"}`。

| provider 名称 | 用途 |
| --- | --- |
| CDT-Refresh | 日常只读查询；Tile 已配置同等查询入口 |
| CDT-History | 输出历史 JSON 到日志 |
| CDT-Notify-Test | 测试已启用通知 |
| CDT-Start / CDT-Stop | 仅在编辑器显式手动控制 |
| CDT-Setup | 仅导入高级 JSON，普通用户留空不运行 |
| CDT-Monitor | 定时监控任务，执行自动策略 |

手动控制的编辑器参数示例：

```json
{"config_source":"local","control_account":"ecs-1","control_confirm":"i-完整实例ID"}
```

同时需要导入的配置 `allowControl=true`；`control_account` 对应 `accounts[].id`。**不要把 Start、Stop、Setup 添加到 cron 或 Tile**。运行时拒绝已知的 cron、schedule、tile、HTTP、network 控制上下文；控制脚本只从编辑器运行并保留 provider 名称。编辑器无法保留名称或传参时，先检查客户端版本及脚本管理入口，不要通过修改类型绕过检查。

高级参数 `control_account/control_confirm/config_json` 也提供在覆写参数表中供记录，但不注册自动使用这些值的任务；编辑器操作仍需显式传参。

## 行为说明

签名、账单、流量、通知、历史及自动控制与其他平台共用核心。CDT 是账号分类汇总，达到阈值禁止启动，失败流量或实例查询不允许控制。手动停机暂停自动启动，控制不确定时进入冷却。

HTTP 超时单位为秒，禁止跟随重定向和 Cookie，验证 TLS；持久化仅写字符串，锁释放写入 JSON `null`。通知配置见共享参数说明。定时任务依赖 VPN 已连接及系统后台状态。

## 验证

模拟测试不等于 iOS 运行验证。请检查覆写解析、表单参数保存、Tile、至少一个 cron 周期及编辑器手动调用。真实 ECS 启停需在自行填写凭据后针对明确的实例验证。

依据：[覆写参数](https://stash.wiki/configuration/override)、[脚本接口](https://stash.wiki/script/syntax-and-interface)、[定时任务](https://stash.wiki/script/scheduled-tasks)、[Tile](https://stash.wiki/script/tile)。
