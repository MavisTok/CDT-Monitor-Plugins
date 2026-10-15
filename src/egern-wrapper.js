// Build replaces the marker with the shared runtime inside this invocation scope.
export default async function (ctx) {
  const CDT_EGERN_CTX = ctx;
  const $script = ctx.script;
  const $argument = ctx.env || {};
  const $request = ctx.request;
  const $persistentStore = {
    read: key => ctx.storage.get(key),
    write: (value, key) => {
      try {
        if (value === null) ctx.storage.delete(key);
        else ctx.storage.set(key, value);
        return true;
      } catch (_) { return false; }
    }
  };
  const $notification = { post: (title, subtitle, body) => ctx.notify({ title, subtitle, body }) };
  const $httpClient = {
    post: (options, callback) => {
      ctx.http.post(options.url, {
        headers: options.headers, body: options.body, timeout: options.timeout * 1000,
        redirect: 'manual', credentials: 'omit', insecureTls: false
      }).then(async response => {
        const text = await response.text();
        callback(null, { status: response.status }, text);
      }).catch(() => callback('网络请求失败或超时', null, ''));
    }
  };
  const result = await new Promise(resolve => {
    const $done = resolve;
    /* CDT_SHARED_RUNTIME */
  });
  if (ctx.cron !== undefined) return;
  return {
    type: 'widget', padding: 12, gap: 8,
    backgroundColor: result.style === 'error' ? '#7F1D1D' : '#162438',
    children: [
      { type: 'text', text: result.title || 'CDT Monitor', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' },
      { type: 'text', text: result.content || '', font: { size: 'caption' }, textColor: '#FFFFFF' }
    ]
  };
}
