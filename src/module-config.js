/* Parameter transport uses | separators, not query-string decoding: URLs with &,
 * tokens with +/= and literal percent signs remain intact after Surge substitution.
 * MODULE_PARAMETER_DEFAULTS is generated from module-parameters.json at build time. */
CDT.parseModuleArguments = function (argument) {
  'use strict';
  if (typeof argument !== 'string' || argument.indexOf('cdt-module-v1|') !== 0) return null;
  var values = Object.create(null);
  argument.slice('cdt-module-v1|'.length).split('|').forEach(function (part) {
    var at = part.indexOf('='), key = part.slice(0, at), value = part.slice(at + 1);
    CDT.assert(at > 0 && (key === 'op' || Object.prototype.hasOwnProperty.call(MODULE_PARAMETER_DEFAULTS, key)), '模块参数格式无效：请勿在值中使用竖线');
    CDT.assert(!Object.prototype.hasOwnProperty.call(values, key), '模块参数重复：' + key);
    CDT.assert(!/["\r\n]/.test(value) && value.indexOf('{{{') < 0, '模块参数未正确替换或包含引号/换行：' + key);
    values[key] = value;
  });
  Object.keys(MODULE_PARAMETER_DEFAULTS).forEach(function (key) {
    if (values[key] === undefined) values[key] = MODULE_PARAMETER_DEFAULTS[key];
    // Surge must substitute a nonempty value even for disabled optional features.
    // Decode only the full reserved value, and only on fields with this default.
    if (MODULE_PARAMETER_DEFAULTS[key] === '未设置' && values[key] === '未设置') values[key] = '';
  });
  CDT.assert(values.config_source === 'module' || values.config_source === 'local', 'config_source 必须为 module 或 local');
  if (values.config_source === 'local') return { op: values.op || 'panel', source: 'local', config: null };
  if (!values.access_key_id || !values.access_key_secret) return { op: values.op || 'panel', source: 'module', config: null, unconfigured: true };
  if (values.daily_report_time === '关闭') values.daily_report_time = '';
  function boolean(key) {
    CDT.assert(values[key] === 'true' || values[key] === 'false', key + ' 必须填写 true 或 false');
    return values[key] === 'true';
  }
  function number(key) {
    CDT.assert(/^[-+]?\d+(\.\d+)?$/.test(values[key]), key + ' 必须填写数字');
    return Number(values[key]);
  }
  var headers = {};
  if (values.webhook_authorization) headers.Authorization = values.webhook_authorization;
  var config = CDT.validate({
    allowControl: boolean('allow_control'),
    timezoneOffsetMinutes: number('timezone_offset_minutes'),
    requestTimeoutSeconds: number('request_timeout_seconds'),
    dailyReportTime: values.daily_report_time,
    notifications: {
      system: boolean('system_notification'),
      telegram: { enabled: boolean('telegram_enabled'), baseURL: values.telegram_base_url, botToken: values.telegram_bot_token, chatId: values.telegram_chat_id },
      webhook: { enabled: boolean('webhook_enabled'), url: values.webhook_url, headers: headers }
    },
    accounts: [{
      id: values.account_id, name: values.account_name, enabled: true,
      accessKeyId: values.access_key_id, accessKeySecret: values.access_key_secret,
      regionId: values.region_id, instanceId: values.instance_id, siteType: values.site_type,
      maxTrafficGiB: number('max_traffic_gib'), thresholdPercent: number('threshold_percent'),
      thresholdAction: values.threshold_action, shutdownMode: values.shutdown_mode,
      keepAlive: boolean('keep_alive'), billing: boolean('billing'),
      schedule: { enabled: boolean('schedule_enabled'), start: values.start_time, stop: values.stop_time }
    }]
  });
  return { op: values.op || 'panel', source: 'module', config: config };
};
