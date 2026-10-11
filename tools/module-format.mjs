// Offline replacement with a strict missing-value check for iOS compatibility.
// Used for validation only; installed modules are expanded by Surge itself.
export function defaultsFromModule(source) {
  const line = source.split('\n').find(line => line.startsWith('#!arguments='));
  if (!line) throw new Error('Module does not declare a parameter table');
  const defaults = Object.create(null);
  for (const item of line.slice('#!arguments='.length).split(',')) {
    const at = item.indexOf(':');
    const key = at < 0 ? item : item.slice(0, at);
    if (!/^[A-Za-z0-9_]+$/.test(key) || Object.hasOwn(defaults, key)) throw new Error('Invalid/duplicate module parameter name');
    defaults[key] = at < 0 ? '' : item.slice(at + 1);
  }
  return defaults;
}

export function renderModule(source, overrides = {}) {
  const defaults = defaultsFromModule(source);
  for (const key of Object.keys(overrides)) if (!Object.hasOwn(defaults, key)) throw new Error('Unknown module parameter: ' + key);
  const values = { ...defaults, ...overrides };
  return source.split('\n').filter(line => !line.startsWith('#!')).join('\n').replace(/\{\{\{([A-Za-z0-9_]+)\}\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error('Undeclared module parameter: ' + key);
    if (values[key] === '' || values[key] === undefined || values[key] === null) throw new Error('Missing module argument value: ' + key);
    return values[key];
  });
}

export function scriptArgument(source, scriptName, overrides = {}) {
  const line = renderModule(source, overrides).split('\n').find(line => line.startsWith(scriptName + ' = '));
  const match = line?.match(/argument="([^"]*)"/);
  if (!match) throw new Error('Script has no argument: ' + scriptName);
  return match[1];
}
