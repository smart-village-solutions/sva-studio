/** Updates changed raw override leaves while retaining untouched explicit pins. */
import {
  diffSsfContentV2,
  isSsfContentRecord as isRecord,
  ssfContentIdentity as contentIdentity,
} from './content-v2-overrides.js';

export const equalSsfContent = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
export const ssfContentPathValue = (value: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
export const setSsfSparsePath = (
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown
): void => {
  const [key, ...rest] = path;
  if (!key) return;
  if (!rest.length) {
    if (value === undefined) delete target[key];
    else target[key] = value;
    return;
  }
  const nested = isRecord(target[key]) ? { ...target[key] } : {};
  setSsfSparsePath(nested, rest, value);
  if (Object.keys(nested).length) target[key] = nested;
  else delete target[key];
};

const patchObject = (
  base: unknown,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  raw: unknown
): unknown => {
  const next = isRecord(raw) ? structuredClone(raw) : {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const value = patchChangedSsfContent(
      isRecord(base) ? base[key] : undefined,
      before[key],
      after[key],
      next[key]
    );
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return Object.keys(next).length ? next : undefined;
};

const patchArrayEntry = (
  original: unknown,
  before: unknown[],
  after: unknown[],
  entries: Record<string, unknown>[]
): void => {
  const identity = contentIdentity(original);
  if (!identity || !isRecord(original)) throw new Error('ssf_v2_diff_identity_missing');
  const identityKey = typeof original['locale'] === 'string' ? 'locale' : 'id';
  const previous = before.find((entry) => contentIdentity(entry) === identity);
  const current = after.find((entry) => contentIdentity(entry) === identity);
  if (equalSsfContent(previous, current)) return;
  const index = entries.findIndex((entry) => contentIdentity(entry) === identity);
  const existing = index >= 0 ? entries[index] : undefined;
  const changed =
    current === undefined
      ? { ...existing, [identityKey]: identity, enabled: false }
      : patchChangedSsfContent(original, previous ?? original, current, existing);
  if (index >= 0) entries.splice(index, 1);
  if (isRecord(changed) && Object.keys(changed).some((key) => key !== identityKey))
    entries.push({ [identityKey]: identity, ...changed });
};

const patchArray = (
  base: unknown[],
  before: unknown[],
  after: unknown[],
  raw: unknown
): unknown => {
  const entries: Record<string, unknown>[] = Array.isArray(raw) ? structuredClone(raw) : [];
  for (const original of base) patchArrayEntry(original, before, after, entries);
  if (
    after.some(
      (entry) => !base.some((original) => contentIdentity(original) === contentIdentity(entry))
    )
  ) {
    throw new Error('ssf_v2_diff_identity_unknown');
  }
  return entries.length ? entries : undefined;
};

export const patchChangedSsfContent = (
  base: unknown,
  before: unknown,
  after: unknown,
  raw: unknown
): unknown => {
  if (equalSsfContent(before, after)) return raw;
  if (isRecord(before) && isRecord(after)) return patchObject(base, before, after, raw);
  if (Array.isArray(base) && Array.isArray(before) && Array.isArray(after))
    return patchArray(base, before, after, raw);
  return equalSsfContent(base, after) ? undefined : diffSsfContentV2(base, after);
};
