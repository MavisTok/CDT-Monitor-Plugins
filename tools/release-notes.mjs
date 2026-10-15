import fs from 'node:fs';
import { releaseInfo } from './release-info.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const info = releaseInfo(pkg);
const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const entry = changelog.split(/^## /m).find(section => section.startsWith(info.tag + ' — '));
if (!entry) throw new Error('Missing changelog entry for ' + info.tag);
process.stdout.write(`日常安装统一使用下方持续更新地址。以后在同一模块中选择“更新模块”，无需每次重新安装。

- iOS：${info.install.ios}
- Mac：${info.install.mac}
- Loon：${info.install.loon}
- Egern：${info.install.egern}
- Stash：${info.install.stash}
- [安装和迁移说明](${info.guide})

已经通过 /v0.3.x/ 等固定版本地址或旧根目录地址安装的模块，需要一次性迁移到上面的平台目录来源。先保留参数；若客户端提供修改来源 URL 的入口，可在原模块中修改，否则只需重新安装一次。以后保持这一来源不变。只启用一份 CDT 模块。

安装入口跟随 main，脚本固定到与模块配套的发布版本；更新模块会同时取得新版脚本引用。旧版标签和 ZIP 保留用于回滚，不能作为日常更新入口。

${entry.slice(entry.indexOf('\n') + 1).trim()}
`);
