(function () {
  'use strict';
  var config, state, rawConfig, leaseToken, ended = false;
  var configKey = CDT.CONFIG_KEY, stateKey = CDT.STATE_KEY, moduleSettings;
  var started = Date.now(), deadline = started + 100000;
  var watchdog;
  var args = {};
  function read(key, fallback) {
    var value = $persistentStore.read(key);
    if (value === null || value === undefined || value === '') return fallback;
    try { return JSON.parse(value); } catch (_) { throw new Error('本地存储损坏：' + key + '，请先导出备份再修复'); }
  }
  function write(key, value) { CDT.assert($persistentStore.write(JSON.stringify(value), key), '本地存储写入失败，已中止操作'); }
  function save() { write(stateKey, state); }
  function safe(error) { return CDT.redact(error && error.message ? error.message : error, config); }
  function pause(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function guard() {
    CDT.assert(!ended && Date.now() < deadline, '本轮运行时间不足，请下轮重试');
    var lock = read(CDT.LOCK_KEY, null);
    CDT.assert(lock && lock.token === leaseToken && lock.expires > Date.now(), '运行锁已失效，已中止操作');
    CDT.assert($persistentStore.read(configKey) === rawConfig, '配置已变更，已中止本轮操作');
  }
  function finish(result) {
    if (ended) return;
    ended = true;
    if (typeof clearTimeout === 'function' && watchdog) clearTimeout(watchdog);
    if (leaseToken) {
      try { var lock = read(CDT.LOCK_KEY, null); if (lock && lock.token === leaseToken) $persistentStore.write(null, CDT.LOCK_KEY); } catch (_) {}
    }
    CDTPlatform.done(result);
  }
  function log(record, message) {
    record.log = record.log || [];
    record.log.push({ at: new Date().toISOString(), message: safe(message) });
    record.log = record.log.slice(-100);
  }
  function request(options) {
    guard();
    CDT.assert(Date.now() + (config.requestTimeoutSeconds + 1) * 1000 < deadline, '请求时间预算不足');
    options.timeout = config.requestTimeoutSeconds;
    options['auto-redirect'] = false;
    options['auto-cookie'] = false;
    return new Promise(function (resolve, reject) {
      $httpClient.post(CDTPlatform.request(options), function (error, response, data) {
        if (ended) { reject(new Error('本轮运行已结束')); return; }
        // Never log raw HTTP errors, URLs or bodies: these may contain signed credentials.
        if (error) { reject(new Error('网络请求失败或超时')); return; }
        var result;
        try { result = JSON.parse(data); } catch (_) { reject(new Error('接口返回非 JSON 数据（HTTP ' + (response && response.status) + '）')); return; }
        if (!response || response.status < 200 || response.status >= 300) {
          var code = result && result.Code;
          reject(new Error('接口 HTTP ' + (response && response.status) + (typeof code === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(code) ? ' / ' + code : '')));
          return;
        }
        resolve(result);
      });
    });
  }
  async function rpc(a, host, region, version, action, extras) {
    var params = {
      AccessKeyId: a.accessKeyId, Action: action, Format: 'JSON', RegionId: region,
      SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0', Version: version,
      SignatureNonce: started.toString(36) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    };
    Object.keys(extras || {}).forEach(function (key) { params[key] = extras[key]; });
    params.Signature = CDT.signature(params, a.accessKeySecret);
    var body = Object.keys(params).sort().map(function (key) { return CDT.encode(key) + '=' + CDT.encode(params[key]); }).join('&');
    var r = await request({ url: 'https://' + host + '/', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body });
    CDT.assert(r && typeof r === 'object', action + ': 无效响应');
    if (r.Code && ['ok', '200', 'success'].indexOf(String(r.Code).toLowerCase()) < 0) {
      var code = /^[A-Za-z0-9_.-]{1,100}$/.test(String(r.Code)) ? String(r.Code) : 'Unknown';
      throw new Error(action + ': ' + code);
    }
    CDT.assert(r.Success !== false, action + ': 接口返回 Success=false');
    CDT.assert(typeof r.RequestId === 'string' && r.RequestId.length > 0, action + ': 响应缺少 RequestId');
    return r;
  }
  function ecs(a, action, extras) { return rpc(a, 'ecs.' + a.regionId + '.aliyuncs.com', a.regionId, '2014-05-26', action, extras); }
  function bss(a, action, extras) {
    return rpc(a, a.siteType === 'international' ? 'business.ap-southeast-1.aliyuncs.com' : 'business.aliyuncs.com', a.siteType === 'international' ? 'ap-southeast-1' : 'cn-hangzhou', '2017-12-14', action, extras);
  }
  function recordFor(a) {
    var record = state.accounts[a.id];
    if (!record || record.identity !== CDT.identity(a)) {
      record = { identity: CDT.identity(a), name: a.name, events: {}, history: [], daily: [], log: [], status: 'Unknown' };
      state.accounts[a.id] = record;
    }
    record.name = a.name;
    record.trafficFresh = false; record.statusFresh = false;
    return record;
  }
  function sample(record, value, now) {
    var l = CDT.local(now, config.timezoneOffsetMinutes);
    var point = { at: new Date(now).toISOString(), bucket: l.hour, cycle: l.cycle, trafficGiB: value };
    if (record.history.length && record.history[record.history.length - 1].bucket === point.bucket) record.history[record.history.length - 1] = point;
    else record.history.push(point);
    record.history = record.history.slice(-720);
    var daily = { date: l.date, at: point.at, cycle: l.cycle, trafficGiB: value };
    if (record.daily.length && record.daily[record.daily.length - 1].date === l.date) record.daily[record.daily.length - 1] = daily;
    else record.daily.push(daily);
    record.daily = record.daily.slice(-180);
  }
  function notify(key, title, body) {
    if (state.notifications[key]) return;
    state.notifications[key] = Date.now();
    var channels = [], n = config.notifications;
    if (n.system) channels.push('system');
    if (n.telegram.enabled) channels.push('telegram');
    if (n.webhook.enabled) channels.push('webhook');
    if (channels.length) state.outbox.push({ key: key, title: safe(title), body: safe(body), channels: channels, attempts: 0, at: new Date().toISOString() });
    state.outbox = state.outbox.slice(-30);
    var keys = Object.keys(state.notifications).sort(function (a, b) { return state.notifications[b] - state.notifications[a]; });
    keys.slice(128).forEach(function (k) { delete state.notifications[k]; });
    save();
  }
  async function flushNotifications() {
    // Bounded persistent outbox; retries occur on the next monitor/manual run.
    var pending = state.outbox.slice(0, 5);
    await Promise.all(pending.map(async function (event) {
      await Promise.all(event.channels.slice().map(async function (channel) {
        try {
          guard();
          var n = config.notifications;
          if (channel === 'system' && n.system) $notification.post('CDT Monitor', event.title, event.body);
          else if (channel === 'telegram' && n.telegram.enabled) {
            var r = await request({ url: n.telegram.baseURL.replace(/\/$/, '') + '/bot' + n.telegram.botToken + '/sendMessage', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: n.telegram.chatId, text: event.title + '\n' + event.body }) });
            CDT.assert(r.ok === true, 'Telegram 发送失败');
          } else if (channel === 'webhook' && n.webhook.enabled) {
            // Webhook may legitimately return 204 or plain text: use its own callback.
            await sendWebhook(event, n.webhook);
          }
          event.channels = event.channels.filter(function (v) { return v !== channel; });
        } catch (_) { event.attempts++; }
      }));
    }));
    state.outbox = state.outbox.filter(function (event) { return event.channels.length > 0; });
    save();
  }
  function sendWebhook(event, settings) {
    guard();
    CDT.assert(Date.now() + (config.requestTimeoutSeconds + 1) * 1000 < deadline, '通知时间预算不足');
    var headers = { 'Content-Type': 'application/json' };
    Object.keys(settings.headers).forEach(function (key) { headers[key] = settings.headers[key]; });
    return new Promise(function (resolve, reject) {
      $httpClient.post(CDTPlatform.request({ url: settings.url, headers: headers, body: JSON.stringify({ source: 'cdt-monitor-' + CDTPlatform.name.toLowerCase(), id: event.key, title: event.title, body: event.body, at: event.at }), timeout: config.requestTimeoutSeconds, 'auto-redirect': false, 'auto-cookie': false }), function (error, response) {
        if (error || !response || response.status < 200 || response.status >= 300 || ended) reject(new Error('Webhook 发送失败'));
        else resolve();
      });
    });
  }
  async function refresh(accounts) {
    var trafficRequests = {};
    await Promise.all(accounts.map(async function (a) {
      var record = recordFor(a);
      var group = a.accessKeyId + ':' + a.accessKeySecret;
      if (!trafficRequests[group]) trafficRequests[group] = rpc(a, 'cdt.aliyuncs.com', 'cn-hongkong', '2021-08-13', 'ListCdtInternetTraffic', {}).then(CDT.traffic);
      await Promise.all([
        trafficRequests[group].then(function (totals) {
          guard();
          record.trafficGiB = totals[CDT.trafficClass(a.regionId)];
          record.trafficAt = new Date().toISOString(); record.trafficFresh = true; record.trafficError = '';
          sample(record, record.trafficGiB, Date.now());
        }).catch(function (e) { record.trafficError = safe(e); }),
        a.instanceId ? ecs(a, 'DescribeInstanceStatus', { RegionId: a.regionId, 'InstanceId.1': a.instanceId, PageSize: '50' }).then(function (r) {
          guard(); record.status = CDT.instanceStatus(r, a.instanceId); record.statusAt = new Date().toISOString(); record.statusFresh = true; record.statusError = '';
        }).catch(function (e) { record.statusError = safe(e); }) : Promise.resolve().then(function () { record.status = '未配置实例'; record.statusError = ''; })
      ]);
    }));
    guard(); save();
  }
  async function billing(accounts) {
    await Promise.all(accounts.filter(function (a) { return a.billing; }).map(async function (a) {
      var record = state.accounts[a.id], now = Date.now(), cycle = CDT.local(now, config.timezoneOffsetMinutes).cycle;
      if (record.billing && record.billing.cycle === cycle && now - record.billing.at < 21600000) return;
      try {
        var results = await Promise.all([
          bss(a, 'QueryAccountBalance', {}).then(function (r) {
            CDT.assert(r.Data, '余额响应缺少 Data');
            CDT.assert(typeof r.Data.Currency === 'string' && r.Data.Currency, '余额响应缺少币种');
            return { balance: CDT.money(r.Data.AvailableAmount), currency: r.Data.Currency };
          }),
          a.instanceId ? queryBill(a, cycle) : Promise.resolve(null)
        ]);
        guard();
        record.billing = { at: Date.now(), cycle: cycle, balance: results[0].balance, currency: results[0].currency, instanceCost: results[1] ? results[1].amount : null, billCurrency: results[1] ? (results[1].currency || results[0].currency) : '' };
        record.billingError = '';
      } catch (e) { record.billingError = safe(e); }
    }));
    guard(); save();
  }
  async function queryBill(a, cycle) {
    var total = 0, seen = 0, token = '', tokens = {}, currency = '';
    for (var page = 1; page <= 10; page++) {
      var r = await bss(a, 'DescribeInstanceBill', { BillingCycle: cycle, InstanceID: a.instanceId, Granularity: 'MONTHLY', NextToken: token, MaxResults: '300' });
      CDT.assert(r.Data && r.Data.Items, '账单响应缺少 Items');
      var items = Array.isArray(r.Data.Items) ? r.Data.Items : r.Data.Items.Item;
      CDT.assert(Array.isArray(items), '账单 Items 格式无效');
      items.forEach(function (item) {
        CDT.assert(item.InstanceID === a.instanceId, '账单返回了其他实例，已拒绝统计');
        CDT.assert(typeof item.Currency === 'string' && item.Currency && (!currency || currency === item.Currency), '账单币种缺失或不一致');
        currency = item.Currency;
        total += CDT.money(item.PretaxAmount);
      });
      seen += items.length;
      CDT.assert(typeof r.Data.NextToken === 'string', '账单响应缺少 NextToken，不能确认分页完整');
      token = r.Data.NextToken;
      if (!token) {
        CDT.assert(r.Data.TotalCount === undefined || seen === CDT.amount(r.Data.TotalCount), '账单记录数量不完整');
        return { amount: Math.round(total * 100) / 100, currency: currency };
      }
      CDT.assert(items.length > 0 && !tokens[token], '账单分页无进展');
      tokens[token] = true;
    }
    throw new Error('账单超过本轮分页上限，未保存不完整金额');
  }
  async function control(a, decision, manual) {
    var record = state.accounts[a.id];
    guard();
    CDT.assert(config.allowControl && a.instanceId, '实例控制尚未启用');
    CDT.assert(record.statusFresh && record.trafficFresh, '最新流量或实例状态不可用，已拒绝控制');
    CDT.assert(record.status === 'Running' || record.status === 'Stopped', '实例正在过渡状态，暂不控制');
    if (decision.action === 'start') CDT.assert(!CDT.over(a, record.trafficGiB), '流量已达到阈值，已拒绝启动');
    var target = decision.action === 'start' ? 'Stopped' : 'Running';
    if (record.status !== target) {
      if (manual) { record.manualPause = decision.action === 'stop'; save(); }
      return false;
    }
    var last = record.lastControl;
    // Reserve before sending: a timed-out request could already have taken effect.
    if (last && Date.now() - last.at < 600000) throw new Error('控制指令处于 10 分钟冷却期，请先刷新实例状态');
    var prior = record.events[decision.key];
    if (!manual && decision.reason === 'schedule' && prior && (prior.status === 'accepted' || Date.now() - prior.at < 600000)) return false;
    record.lastControl = { action: decision.action, at: Date.now(), status: 'pending' };
    record.events[decision.key] = { at: Date.now(), status: 'pending' };
    if (manual) record.manualPause = decision.action === 'stop';
    save();
    try {
      guard();
      var extras = { RegionId: a.regionId, InstanceId: a.instanceId };
      if (decision.action === 'stop') extras.StoppedMode = a.shutdownMode;
      await ecs(a, decision.action === 'start' ? 'StartInstance' : 'StopInstance', extras);
      guard();
      record.status = decision.action === 'start' ? 'Starting' : 'Stopping'; record.statusFresh = false;
      record.lastControl.status = 'accepted'; record.events[decision.key].status = 'accepted';
      record.controlError = '';
      log(record, decision.reason + ': ' + decision.action + ' 指令已接受，尚待状态确认');
      notify(a.id + ':control:' + decision.action + ':' + record.lastControl.at, a.name + ' 控制指令已接受', (decision.action === 'start' ? '启动' : '停止') + ' / ' + decision.reason + '；等待后续查询确认。');
      return true;
    } catch (e) {
      record.lastControl.status = 'uncertain'; record.events[decision.key].status = 'uncertain';
      record.controlError = safe(e); log(record, '控制失败或结果未知：' + safe(e)); save();
      throw e;
    }
  }
  async function automate(accounts) {
    await Promise.all(accounts.map(async function (a) {
      var record = state.accounts[a.id], cycle = CDT.local(Date.now(), config.timezoneOffsetMinutes).cycle;
      if (record.trafficFresh) {
        var key = a.id + ':threshold:' + cycle;
        if (CDT.over(a, record.trafficGiB)) notify(key, a.name + ' 流量阈值告警', '账号' + (CDT.trafficClass(a.regionId) === 'china' ? '国内' : '海外') + '汇总 ' + record.trafficGiB.toFixed(2) + ' / ' + a.maxTrafficGiB + ' GiB；阈值 ' + a.thresholdPercent + '%。');
        else delete state.notifications[key];
      }
      var error = record.trafficError || record.statusError;
      if (error && record.lastQueryError !== error) notify(a.id + ':query:' + Date.now(), a.name + ' 查询失败', error + '；显示缓存，自动控制暂停。');
      record.lastQueryError = error || '';
      var decision = CDT.decide(a, record, Date.now(), config);
      if (decision) {
        try { await control(a, decision, false); }
        catch (e) {
          var message = safe(e);
          if (record.lastControlError !== message) notify(a.id + ':control-error:' + Date.now(), a.name + ' 控制未完成', message);
          record.lastControlError = message;
        }
      } else if (record.statusFresh && (record.status === 'Running' || record.status === 'Stopped')) {
        // A fresh state query confirms the result of an earlier accepted/uncertain action.
        if (record.lastControl && ((record.lastControl.action === 'start' && record.status === 'Running') || (record.lastControl.action === 'stop' && record.status === 'Stopped'))) {
          record.controlError = ''; record.lastControlError = '';
        }
      }
      var eventKeys = Object.keys(record.events).sort(function (x, y) { return record.events[y].at - record.events[x].at; });
      eventKeys.slice(64).forEach(function (k) { delete record.events[k]; });
    }));
    guard(); save();
    var date = CDT.due(Date.now(), config.timezoneOffsetMinutes, config.dailyReportTime);
    if (date) notify('daily:' + date, 'CDT 流量日报 ' + date, accounts.map(function (a) {
      var r = state.accounts[a.id];
      return a.name + ': ' + (typeof r.trafficGiB === 'number' ? r.trafficGiB.toFixed(2) + ' GiB' : '暂无数据') + ' / ' + r.status + (r.trafficFresh ? '' : '（缓存或查询失败）');
    }).join('\n'));
  }
  function panel(accounts) {
    var lines = [], alert = false, error = false;
    accounts.forEach(function (a) {
      var r = state && state.accounts[a.id];
      if (!r) { lines.push(a.name + '：暂无数据'); return; }
      var label = CDT.trafficClass(a.regionId) === 'china' ? '国内' : '海外';
      var usage = typeof r.trafficGiB === 'number' ? r.trafficGiB.toFixed(2) + ' / ' + a.maxTrafficGiB + ' GiB (' + (r.trafficGiB / a.maxTrafficGiB * 100).toFixed(1) + '%)' : '暂无数据';
      alert = alert || (typeof r.trafficGiB === 'number' && CDT.over(a, r.trafficGiB));
      var statusNames = { Running: '运行中', Stopped: '已停止', Starting: '启动中', Stopping: '停止中', Unknown: '未知' };
      lines.push(a.name + ' · ' + label + '账号汇总\n' + usage + '\n实例：' + (statusNames[r.status] || r.status) + (r.manualPause ? ' · 手动暂停自动启动' : ''));
      if (r.billing) lines.push('余额 ' + r.billing.balance.toFixed(2) + ' ' + r.billing.currency + (r.billing.instanceCost !== null ? ' · 本月实例账单 ' + r.billing.instanceCost.toFixed(2) + ' ' + r.billing.billCurrency : '') + '（缓存；' + CDT.local(r.billing.at, config.timezoneOffsetMinutes).label + '）');
      if (r.trafficAt) lines.push('流量时间 ' + CDT.local(Date.parse(r.trafficAt), config.timezoneOffsetMinutes).label);
      var errors = [r.trafficError, r.statusError, r.controlError, r.billingError].filter(Boolean);
      if (errors.length) { error = true; lines.push('⚠ ' + errors.join('；') + '（旧数据仅供参考）'); }
    });
    if (state.outbox.length) lines.push('待重试通知：' + state.outbox.length);
    return { title: 'CDT Monitor · ' + (config.allowControl ? '控制已允许' : '只读模式'), content: lines.join('\n\n'), style: error ? 'error' : alert ? 'alert' : 'info' };
  }
  function parseArgs(value) {
    var result = {};
    String(value || '').split('&').forEach(function (pair) { var p = pair.indexOf('='); if (p >= 0) result[decodeURIComponent(pair.slice(0, p))] = decodeURIComponent(pair.slice(p + 1)); });
    return result;
  }
  async function main() {
    var argument = typeof $argument === 'undefined' ? '' : $argument;
    var loonArgs;
    if (CDTPlatform.loon) {
      CDT.assert(argument && typeof argument === 'object' && !Array.isArray(argument), '请使用 Loon 插件参数运行');
      loonArgs = argument;
      argument = {};
      Object.keys(MODULE_PARAMETER_DEFAULTS).forEach(function (key) { if (Object.prototype.hasOwnProperty.call(loonArgs, key)) argument[key] = loonArgs[key]; });
      argument.op = CDTPlatform.operation();
    }
    moduleSettings = CDT.parseModuleArguments(argument);
    if (moduleSettings && moduleSettings.unconfigured) {
      finish({ title: 'CDT Monitor · 尚未配置', content: '请在模块参数中将 access_key_id 和 access_key_secret 的“未设置”替换为自己的 RAM 密钥，保存后刷新面板。未使用的可选项保留“未设置”。', style: 'info' });
      return;
    }
    args = moduleSettings ? { op: moduleSettings.op } : parseArgs(argument);
    if (CDTPlatform.loon && (args.op === 'start' || args.op === 'stop')) {
      args.account = loonArgs.control_account;
      args.confirm = loonArgs.control_confirm;
    }
    if (!CDTPlatform.loon && typeof $intent !== 'undefined' && $intent && $intent.parameter) {
      var input = $intent.parameter;
      var intent;
      try { intent = typeof input === 'string' ? (input.trim().charAt(0) === '{' ? JSON.parse(input) : parseArgs(input)) : input; }
      catch (_) { throw new Error('快捷指令参数格式无效'); }
      CDT.assert(intent && typeof intent === 'object', '快捷指令参数无效');
      Object.keys(intent).forEach(function (k) { args[k] = intent[k]; });
    }
    var op = args.op || 'panel';
    CDT.assert(['panel', 'monitor', 'refresh', 'start', 'stop', 'history', 'test-notify'].indexOf(op) >= 0, '未知操作');
    if (typeof $input !== 'undefined' && $input && $input.purpose === 'panel') op = 'panel';
    if (moduleSettings && moduleSettings.source === 'module') {
      config = moduleSettings.config;
      configKey = 'cdt.local.module-config.v1';
      stateKey = 'cdt.local.module-state.v1';
      rawConfig = JSON.stringify(config);
    } else {
      rawConfig = $persistentStore.read(configKey);
      if (!rawConfig) { finish({ title: 'CDT Monitor · 尚未配置', content: '在模块参数中填写 AccessKey 和实例信息；若 config_source=local，请先导入本地 JSON 配置。', style: 'info' }); return; }
      config = CDT.validate(read(configKey, null));
    }
    state = read(stateKey, { version: 1, accounts: {}, notifications: {}, outbox: [] });
    CDT.assert(state.version === 1 && state.accounts && state.notifications && Array.isArray(state.outbox), '本地状态格式无效');
    var accounts = config.accounts.filter(function (a) { return a.enabled && (!args.account || a.id === args.account); });
    CDT.assert(accounts.length > 0, '没有匹配的启用账号');
    if (op === 'history') {
      var report = accounts.map(function (a) { var r = state.accounts[a.id]; return { id: a.id, name: a.name, scope: CDT.trafficClass(a.regionId) + ' account aggregate', hourly: r ? r.history : [], daily: r ? r.daily : [], log: r ? r.log : [] }; });
      console.log(JSON.stringify(report));
      finish({ title: 'CDT 本地历史', content: '已输出到脚本日志（包含小时、日快照和操作记录）。', result: JSON.stringify(report) }); return;
    }
    if (op === 'start' || op === 'stop') {
      CDT.assert(config.allowControl && args.account && accounts.length === 1, '手动控制需要 allowControl=true，并明确指定 account=id');
      CDT.assert(args.confirm === accounts[0].instanceId && accounts[0].instanceId, '手动控制需要 confirm=完整实例ID');
      CDT.assert(CDTPlatform.manual(op), '控制仅允许显式手动脚本、快捷指令、编辑器或本地 API 调用');
    }
    var oldLock = read(CDT.LOCK_KEY, null);
    if (oldLock && oldLock.expires > Date.now()) { finish({ title: 'CDT Monitor · 正在运行', content: '另一轮查询/控制尚未结束，请稍后刷新。', style: 'info' }); return; }
    leaseToken = started.toString(36) + Math.random().toString(36).slice(2);
    write(CDT.LOCK_KEY, { token: leaseToken, expires: started + 125000 });
    await pause(80);
    if (moduleSettings && moduleSettings.source === 'module') {
      var ownedLock = read(CDT.LOCK_KEY, null);
      CDT.assert(ownedLock && ownedLock.token === leaseToken && ownedLock.expires > Date.now(), '运行锁已失效，未保存模块参数');
      var previousConfig = $persistentStore.read(configKey);
      if (previousConfig !== rawConfig) {
        if (previousConfig) CDT.assert($persistentStore.write(previousConfig, 'cdt.local.module-config.backup.v1'), '原模块参数备份失败，已中止');
        CDT.assert($persistentStore.write(rawConfig, configKey), '模块参数保存失败，已中止');
      }
    }
    guard();
    watchdog = setTimeout(function () { finish({ title: 'CDT Monitor · 本轮超时', content: '已保存的缓存保留；请下轮查询确认控制结果。', style: 'error' }); }, 105000);
    // Prune removed/disabled accounts from runtime data without retaining credentials.
    Object.keys(state.accounts).forEach(function (id) { if (!config.accounts.some(function (a) { return a.enabled && a.id === id; })) delete state.accounts[id]; });
    await refresh(accounts);
    if (op === 'monitor') await automate(accounts);
    if (op === 'start' || op === 'stop') await control(accounts[0], { action: op, reason: 'manual', key: 'manual:' + started }, true);
    if (op === 'test-notify') notify('test:' + started, '通知测试', 'CDT Monitor ' + CDTPlatform.name + ' 本地通知测试。');
    await billing(accounts);
    if (op !== 'panel' && op !== 'refresh') await flushNotifications();
    guard(); state.lastRun = new Date().toISOString(); save();
    finish(panel(accounts));
  }
  main().catch(function (e) {
    var message = safe(e);
    console.log('CDT Monitor: ' + message);
    finish({ title: 'CDT Monitor · 错误', content: message, style: 'error' });
  });
})();
