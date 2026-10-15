# CDT Monitor Plugins 四平台适配设计

用户已确认仓库名称 CDT-Monitor-Plugins，以及共享核心、平台独立发布目录的四平台方案。保留现有未发布的 Loon 中文说明，版本升级为 v0.5.0。

## 结构与实现

- surge/、loon/ 保留平台模块、构建脚本与说明；新增 egern/ 和 stash/。
- src/ 保留签名、参数校验及业务运行时。Egern 使用 export default async function(ctx) 包装器，在单次函数作用域内桥接 HTTP、存储、通知与完成结果；不向其他脚本污染全局变量。
- Egern 使用 env_schema 生成中文表单，ctx.env 读取值；脚本默认 env 提供实际默认值，因为 env_schema.default_value 只是占位。schedule 只执行 monitor，generic 默认只查询；Widget 输出官方 Widget DSL。
- Stash 使用 .stoverride、arguments-version: 1 和 |json 传递配置字符串，最低版本按官方参数文档注明 iOS/tvOS 3.7+、macOS 4.4+（Beta）。cron 执行自动策略，Tile 只能查询。手动控制通过独立脚本在编辑器执行，不注册为 Tile 或定时任务。
- Egern HTTP 请求转换为毫秒，redirect=manual、credentials=omit、insecureTls=false。Stash 使用秒，显式关闭重定向和 Cookie，并校验证书。
- Stash 存储只使用文档支持的字符串写入；运行锁释放写入 JSON null 字符串，避免依赖未记录的 null 删除行为。

## 配置、操作与展示

普通用户使用各平台参数表输入 ID、Secret、地域、额度，保存后运行 Refresh 或刷新只读面板。Setup 仅导入完整高级 JSON；未填写 JSON 时返回清楚的引导而非模糊的保存错误。

支持查询、账单、通知及重试、日报、历史、阈值停机、计划启停、保活与显式手动启停。原有实时查询保护、运行锁、冷却和手动停机暂停逻辑共用。面板、Tile、普通 Widget 不读取控制指令；控制入口需匹配账号和完整实例 ID，拒绝计划、HTTP、Widget 自动运行上下文。

Stash 编辑器无覆写参数作用域，文档提供实际编辑器参数操作；使用高级本地配置时以 config_source=local 读取。不得假装编辑器自动继承覆写参数。

## 改名和发布

GitHub 仓库改为 MavisTok/CDT-Monitor-Plugins；更新 origin、package.json、所有当前文档、模块下载链接、安装 Scheme 和发布脚本。历史 CHANGELOG 不改写旧版本事实。main 上平台安装地址持续更新，配套脚本指向 v0.5.0 标签。

## 验证

运行原有回归与新增 Egern、Stash 模拟测试：参数解析、请求超时和 TLS、存储、锁释放、Widget/Tile、失败不控制、显式启停、计划入口拒绝手动控制、通知重试和 Setup。生成 YAML 做解析及结构断言，确认脚本引用和四平台文档链接。最后提交、推送 main 和 v0.5.0 并核对远程文件存在。

已自查目录、接口单位、表单默认值、字符串存储和编辑器参数边界；本地模拟成功不等同于 iOS 实机导入和后台调度验证。无后台服务、云端凭据存储或跨设备自动迁移。
