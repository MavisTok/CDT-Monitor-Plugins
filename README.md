# CDT Monitor Plugins

阿里云 CDT 流量监控、通知与 ECS 实例控制插件，支持 **Surge、Loon、Egern、Stash**。

直接在客户端本地调用阿里云 CDT/ECS/BSS HTTPS API，无需部署后台、Docker 或数据库。移植自 [wang4386/CDT-Monitor](https://github.com/wang4386/CDT-Monitor)，遵循 [MIT 许可](LICENSE)，属于独立客户端实现。

## 安装入口

| 平台 | 使用说明 | 持续更新安装地址 |
| --- | --- | --- |
| Surge iOS | [Surge](surge/README.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/surge/CDT-Monitor.sgmodule |
| Surge Mac | [安装步骤](surge/安装说明.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/surge/CDT-Monitor-Mac.sgmodule |
| Loon 3.5.1 (983)+ | [Loon](loon/README.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/loon/CDT-Monitor.plugin |
| Egern（原生 ctx API） | [Egern](egern/README.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/egern/CDT-Monitor.yaml |
| Stash iOS/tvOS 3.7+、Mac 4.4+（参数功能 Beta） | [Stash](stash/README.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Plugins/refs/heads/main/stash/CDT-Monitor.stoverride |

**v0.5.0 仓库统一更名为 `CDT-Monitor-Plugins`。** 保留旧模块的参数后，更新安装来源为上表地址。安装入口跟随 `main`，内部脚本固定到 `v0.5.0`；模块文件与对应版本标签均发布后才可下载。旧仓库重定向只用于过渡，推荐保存新地址。

## 第一次使用

1. 在对应模块/插件/覆写的参数表中保留 `config_source=module`。
2. 填写 **AccessKey ID 和 AccessKey Secret 两项**、地域和实际流量额度。
3. 保存后运行 **CDT-Refresh** 或刷新只读面板/Widget。

**普通用户无需运行 CDT-Setup**：它仅用于导入高级多账号 JSON。模块内提供中文参数和操作说明。Surge 的字段对照见其平台文档。

## 功能

- CDT 国内/海外分类用量、额度、阈值告警与 ECS 精确实例状态。
- 可选余额和月度实例账单；本地小时/日历史与操作日志。
- 系统、Telegram、Webhook 通知，失败重试和日报。
- 可选阈值停机、计划启停、实例保活及显式手动控制，默认只读。
- 单账号表单配置；高级 JSON 支持 1–8 条账号/实例记录。

CDT 是**阿里云账号分类汇总**，不是单台 ECS 的独立用量，也不是本机代理流量。启停要求本轮成功查询流量与目标实例状态；失败保留缓存并显示错误，不以缺失数据启动实例。

Surge 有原生面板，Loon 用 Generic 返回内容，Egern 用 Widget DSL，Stash 用 Tile。面板/Widget/Tile 只查询，不执行手动启停或自动策略。定时监控默认每 10 分钟运行，受到设备后台状态、VPN 连接、网络及云端统计延迟影响。

## 手动操作速查

| 入口 | 用途 |
| --- | --- |
| CDT-Refresh | 查询流量、实例及可选账单 |
| CDT-Monitor | 每10分钟监控，执行已开启策略、日报及通知重试 |
| CDT-History | 输出历史和操作日志 JSON |
| CDT-Notify-Test | 测试通知通道 |
| CDT-Start / CDT-Stop | 显式开机/关机；需控制总开关、账号和完整实例确认 |
| CDT-Setup | 仅高级 JSON 导入 |

各平台入口不同：Surge 使用 CDT-Control 快捷指令，Stash 使用脚本编辑器；详见平台文档。不同应用的配置与历史独立保存，不自动同步。

## 开发与验证

```text
surge/、loon/、egern/、stash/  各平台安装文件、打包脚本及中文说明
src/                         共享业务核心与平台入口
tools/                       构建、发布说明和校验工具
tests/                       平台模拟与业务回归测试
config.example.json          多账号配置示例
```

在仓库根目录使用 Node.js 20+，没有第三方 npm 依赖：

```powershell
npm run build
npm test
npm run release:notes
```

修改源码后必须重新构建。个人 Setup 配置另存为 `cdt-setup.private.js`，构建会拒绝覆盖已编辑的公开 Setup。Egern 是原生 ES module，其余为客户端脚本。生成 YAML 使用 JSON 兼容形式，避免额外序列化依赖。

测试全部使用模拟 API，不操作真实云资源。Surge Mac 原生离线校验可运行 `node tools/validate-surge.mjs`。新增平台仍需 iOS 实机验证导入、参数保存、展示、定时调度与用户授权的云端操作。

发布元信息由 `package.json` 生成，安装入口由 `tools/release-info.mjs` 统一定义。发布时推送 `main` 和配套 `v<version>` 标签。参见 [更新记录](CHANGELOG.md) 和 [安装地址清单](INSTALL-URLS.txt)。
