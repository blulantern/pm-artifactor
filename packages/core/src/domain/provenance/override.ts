export interface EditOpts {
  connected: boolean;
  overriddenFields: string[];
}

export function applyEdit<T extends Record<string, unknown>>(
  current: T,
  patch: Partial<T>,
  opts: EditOpts,
): { values: T; overriddenFields: string[] } {
  const values = { ...current, ...patch };
  if (!opts.connected) return { values, overriddenFields: opts.overriddenFields };
  const changed = Object.keys(patch).filter((k) => !Object.is(current[k], (patch as Record<string, unknown>)[k]));
  return { values, overriddenFields: [...new Set([...opts.overriddenFields, ...changed])] };
}

export function mergePull<T extends Record<string, unknown>>(
  current: T,
  pulled: Partial<T>,
  overriddenFields: string[],
): T {
  const overridden = new Set(overriddenFields);
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(pulled)) {
    if (!overridden.has(k)) out[k] = v;
  }
  return out as T;
}

export function sever(_overriddenFields: string[]): { overriddenFields: string[] } {
  return { overriddenFields: [] };
}
