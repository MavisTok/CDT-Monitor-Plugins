(function () {
  'use strict';
  try {
    // Allow importing local JSON through Shortcuts, without any cloud intermediary.
    var source = LOCAL_CONFIG;
    if (CDTPlatform.loon) {
      CDT.assert(typeof $script !== 'undefined' && $script.name === 'CDT-Setup' && typeof $request === 'undefined', '请手动运行 CDT-Setup');
      if (typeof $argument !== 'undefined' && $argument && $argument.config_json) source = JSON.parse($argument.config_json);
    }
    if (typeof $intent !== 'undefined' && $intent && $intent.parameter) source = typeof $intent.parameter === 'string' ? JSON.parse($intent.parameter) : $intent.parameter;
    var config = CDT.validate(source);
    var lockRaw = $persistentStore.read(CDT.LOCK_KEY);
    var lock = lockRaw ? JSON.parse(lockRaw) : null;
    CDT.assert(!lock || lock.expires <= Date.now(), '监控正在运行，请稍后保存配置');
    var old = $persistentStore.read(CDT.CONFIG_KEY);
    if (old) CDT.assert($persistentStore.write(old, 'cdt.local.config.backup.v1'), '原配置备份失败，未覆盖');
    CDT.assert($persistentStore.write(JSON.stringify(config), CDT.CONFIG_KEY), '配置写入失败');
    var enabled = config.accounts.filter(function (a) { return a.enabled; });
    var content = '已保存 ' + enabled.length + ' 条启用记录；' + (config.allowControl ? '允许实例控制，请确认各项策略。' : '只读监控模式。') + '\n请运行 CDT-Refresh 验证阿里云查询。';
    if (config.notifications.system) $notification.post('CDT Monitor', '本地配置已保存', content);
    CDTPlatform.done({ title: 'CDT 配置已保存', content: content, style: 'info' });
  } catch (e) {
    console.log('CDT Setup: 配置未保存，请检查字段格式。');
    CDTPlatform.done({ title: 'CDT 配置未保存', content: e instanceof SyntaxError ? 'JSON 格式无效；原配置未覆盖。' : String(e.message), style: 'error' });
  }
})();
