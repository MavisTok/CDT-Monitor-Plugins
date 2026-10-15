# CDT Monitor for Surge & Loon

阿里云 CDT 流量监控、通知与 ECS 实例控制插件

在 Surge 或 Loon 本地直接调用阿里云 CDT、ECS、BSS API，查询流量和实例状态，并按配置执行通知与实例启停。无需后台服务、Docker 或数据库。

移植自 [wang4386/CDT-Monitor](https://github.com/wang4386/CDT-Monitor)，遵循 [MIT 许可](LICENSE)。这是独立客户端实现。

## 选择你的平台

| 平台 | 使用说明 | 持续更新安装地址 |
| --- | --- | --- |
| Surge iOS / iPadOS | [Surge 文档](surge/README.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Surge-Loon/refs/heads/main/surge/CDT-Monitor.sgmodule |
| Surge Mac | [详细安装说明](surge/安装说明.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Surge-Loon/refs/heads/main/surge/CDT-Monitor-Mac.sgmodule |
| Loon 3.5.1 (983)+ | [Loon 文档](loon/README.md) | https://raw.githubusercontent.com/MavisTok/CDT-Monitor-Surge-Loon/refs/heads/main/loon/CDT-Monitor.plugin |

**v0.4.1 仓库更名为 `CDT-Monitor-Surge-Loon`；v0.4.0 起按平台分目录。** 旧安装来源请保留已有参数后改用上表地址。安装入口跟随 `main`，内部脚本固定到 `v0.4.1`。以后在原模块或插件中更新即可。GitHub 的旧仓库重定向可用于过渡，建议保存新的安装来源。

## 功能

- CDT 国内/海外分类流量、额度及阈值告警；ECS 精确实例状态。
- 可选余额及月度实例账单；本地小时/日历史和操作日志。
- 系统、Telegram、Webhook 通知；日报与失败重试队列。
- 可选阈值停机、定时启停、保活和手动启停，默认只读。
- 参数表单管理单账号；高级 JSON 支持 1–8 条账号/实例记录。

CDT 用量是**阿里云账号分类汇总**，不是单台 ECS 用量，也不是本机代理流量。自动控制要求本轮成功获取流量及实例状态；查询失败显示旧数据和错误。默认每 10 分钟检查，受设备后台运行、联网及云端统计延迟影响。

Surge 提供原生面板；Loon 通过 Generic 手动脚本返回结果，并在脚本日志中保留查询摘要。两平台共享业务逻辑，各自在应用内保存配置和历史。

## 仓库结构

```text
surge/               Surge 模块、打包脚本、原平台 README 与安装说明
loon/                Loon 插件、打包脚本及使用说明
src/                 共享签名、参数校验、运行时及平台适配
tools/               构建、发布说明、Surge 原生校验
tests/               Node 模拟环境与回归测试
config.example.json  高级多账号配置示例
INSTALL-URLS.txt     构建生成的安装入口
```

## 开发与验证

使用支持 `node --test` 的 Node.js（建议 Node 20+），在仓库根目录运行，无第三方依赖，无需 `npm install`：

```powershell
npm run build
npm test
npm run release:notes
```

构建会生成两个平台的发布文件。修改 `src/` 后重新构建；已填写的个人 Setup 配置应另存为 `cdt-setup.private.js`，构建会拒绝覆盖修改过的配置。

测试使用模拟云 API，不会操作真实 ECS。Mac 安装 Surge 后，可额外运行 `node tools/validate-surge.mjs`；该原生校验不可在 Windows 上运行。Loon 插件仍应在实际客户端完成导入、参数保存、手动查询和 cron 调度验证。

## 配置与发布

首次安装在对应平台参数表填写 RAM AccessKey、地域、实际流量额度；仅查流量时无需实例 ID。详细字段、权限和手动控制方式见各平台文档。凭据只保存在设备设置与本地存储中，导出配置时会包含凭据。

发布地址由 `package.json` 的仓库与版本字段生成；更换仓库时需修改该字段、重新构建并更新文档中的安装地址。发布需同时上传平台产物至 `main` 并发布配套 `v<version>` 标签。参见 [更新记录](CHANGELOG.md)。
