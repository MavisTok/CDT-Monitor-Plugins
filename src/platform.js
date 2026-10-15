// Only documented host APIs are used; no synthetic Surge trigger globals.
var CDTPlatform = (function () {
  'use strict';
  var loon = typeof $loon !== 'undefined';
  var names = { 'CDT-Monitor': 'monitor', 'CDT-Refresh': 'refresh', 'CDT-History': 'history', 'CDT-Notify-Test': 'test-notify', 'CDT-Start': 'start', 'CDT-Stop': 'stop' };
  function operation() {
    var name = typeof $script !== 'undefined' && $script ? $script.name : '';
    CDT.assert(Object.prototype.hasOwnProperty.call(names, name), '请从 CDT 插件中选择对应的脚本运行');
    CDT.assert(typeof $request === 'undefined', '不支持从 HTTP 脚本执行 CDT 操作');
    return names[name];
  }
  return {
    loon: loon,
    name: loon ? 'Loon' : 'Surge',
    operation: operation,
    request: function (options) {
      if (loon) { options.timeout *= 1000; options.insecure = false; }
      return options;
    },
    manual: function (op) {
      if (loon) return operation() === op && (op === 'start' || op === 'stop');
      return typeof $trigger !== 'undefined' && ['intent', 'editor', 'http-api'].indexOf($trigger) >= 0;
    },
    done: function (result) {
      if (loon && result) console.log((result.title || 'CDT Monitor') + '\n' + (result.content || ''));
      $done(result || {});
    }
  };
})();
