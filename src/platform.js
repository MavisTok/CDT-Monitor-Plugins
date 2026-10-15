// Only documented host APIs are used; no synthetic Surge trigger globals.
var CDTPlatform = (function () {
  'use strict';
  var loon = typeof $loon !== 'undefined';
  var egern = typeof CDT_EGERN_CTX !== 'undefined';
  var stash = !egern && typeof $environment !== 'undefined' && $environment && $environment['stash-version'] !== undefined;
  var named = loon || egern || stash;
  var names = { 'CDT-Monitor': 'monitor', 'CDT-Refresh': 'refresh', 'CDT-History': 'history', 'CDT-Notify-Test': 'test-notify', 'CDT-Start': 'start', 'CDT-Stop': 'stop' };
  function operation() {
    var name = typeof $script !== 'undefined' && $script ? $script.name : '';
    CDT.assert(Object.prototype.hasOwnProperty.call(names, name), '请从 CDT 插件中选择对应的脚本运行');
    CDT.assert(typeof $request === 'undefined', '不支持从 HTTP 脚本执行 CDT 操作');
    if (stash && $script.type === 'tile') return 'panel';
    if (egern && CDT_EGERN_CTX.cron !== undefined) {
      CDT.assert(name === 'CDT-Monitor', '定时入口只能执行自动监控');
      return 'monitor';
    }
    if (egern && CDT_EGERN_CTX.widgetFamily !== undefined) return 'panel';
    return names[name];
  }
  return {
    loon: loon,
    named: named,
    name: egern ? 'Egern' : stash ? 'Stash' : loon ? 'Loon' : 'Surge',
    operation: operation,
    request: function (options) {
      if (loon) options.timeout *= 1000;
      if (named) options.insecure = false;
      return options;
    },
    manual: function (op) {
      if (named) {
        if (operation() !== op || (op !== 'start' && op !== 'stop')) return false;
        if (stash) return ['generic', 'editor'].indexOf($script.type) >= 0;
        if (egern) return CDT_EGERN_CTX.cron === undefined && CDT_EGERN_CTX.widgetFamily === undefined && !CDT_EGERN_CTX.request;
        return true;
      }
      return typeof $trigger !== 'undefined' && ['intent', 'editor', 'http-api'].indexOf($trigger) >= 0;
    },
    done: function (result) {
      if (named && result) console.log((result.title || 'CDT Monitor') + '\n' + (result.content || ''));
      $done(result || {});
    },
    releaseLock: function (key) {
      // Stash documents string writes only. JSON null is equivalent to no lease.
      $persistentStore.write(stash ? 'null' : null, key);
    },
    setupAllowed: function () {
      if (!named) return true;
      if (typeof $script === 'undefined' || $script.name !== 'CDT-Setup' || typeof $request !== 'undefined') return false;
      if (stash) return ['generic', 'editor'].indexOf($script.type) >= 0;
      return !egern || (CDT_EGERN_CTX.cron === undefined && CDT_EGERN_CTX.widgetFamily === undefined && !CDT_EGERN_CTX.request);
    }
  };
})();
