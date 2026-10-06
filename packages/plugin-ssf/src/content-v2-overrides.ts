import { ssfRuntimeContentV2FieldsSchema, type SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const contentIdentity = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  return typeof value['locale'] === 'string'
    ? value['locale']
    : typeof value['id'] === 'string'
      ? value['id']
      : null;
};

const mergeArray = (base: unknown[], overrides: unknown[]): unknown[] => {
    const indexed = new Map(overrides.map((entry) => [contentIdentity(entry), entry]));
    if (indexed.has(null) || indexed.size !== overrides.length) {
      throw new Error('ssf_v2_override_identity_invalid');
    }
    for (const key of indexed.keys()) {
      if (!base.some((entry) => contentIdentity(entry) === key)) {
        throw new Error('ssf_v2_override_identity_unknown');
      }
    }
    return base.flatMap((entry) => {
      const changed = indexed.get(contentIdentity(entry));
      if (isRecord(changed) && changed['enabled'] === false) return [];
      return [mergeSsfContentV2(entry, changed)];
    });
};

const mergeObject = (base: Record<string, unknown>, overrides: Record<string, unknown>) => {
    for (const key of Object.keys(overrides)) {
      if (!Object.prototype.hasOwnProperty.call(base, key) && key !== 'enabled' &&
          !['headline', 'required', 'minLabel', 'maxLabel', 'placeholder', 'maxLength', 'icon'].includes(key)) {
        throw new Error('ssf_v2_override_field_unknown');
      }
    }
    return Object.fromEntries(
      [...new Set([...Object.keys(base), ...Object.keys(overrides)])]
        .filter((key) => key !== 'enabled')
        .map((key) => [key, mergeSsfContentV2(base[key], overrides[key])])
    );
};

/** Sparse tenant overrides use stable locale and question IDs. */
export const mergeSsfContentV2 = (base: unknown, overrides: unknown): unknown => {
  if (overrides === undefined) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(overrides)) throw new Error('ssf_v2_override_array_invalid');
    return mergeArray(base, overrides);
  }
  if (isRecord(base)) {
    if (!isRecord(overrides)) throw new Error('ssf_v2_override_object_invalid');
    return mergeObject(base, overrides);
  }
  return overrides;
};

const diffArray = (base: unknown[], current: unknown[]): unknown => {
    const changes: Record<string, unknown>[] = [];
    for (const original of base) {
      const key = contentIdentity(original);
      if (!key) throw new Error('ssf_v2_diff_identity_missing');
      const edited = current.find((entry) => contentIdentity(entry) === key);
      const identityKey = isRecord(original) && typeof original['locale'] === 'string' ? 'locale' : 'id';
      if (edited === undefined) {
        changes.push({ [identityKey]: key, enabled: false });
      } else {
        const difference = diffSsfContentV2(original, edited);
        if (isRecord(difference) && Object.keys(difference).length > 0) {
          changes.push({ [identityKey]: key, ...difference });
        }
      }
    }
    if (current.some((entry) => !base.some((original) => contentIdentity(original) === contentIdentity(entry)))) {
      throw new Error('ssf_v2_diff_identity_unknown');
    }
    return changes.length === 0 ? undefined : changes;
};

const diffObject = (base: Record<string, unknown>, current: Record<string, unknown>): unknown => {
    const changes = Object.fromEntries(
      [...new Set([...Object.keys(base), ...Object.keys(current)])].flatMap((key) => {
        const difference = diffSsfContentV2(base[key], current[key]);
        return difference === undefined ? [] : [[key, difference]];
      })
    );
    return Object.keys(changes).length === 0 ? undefined : changes;
};

export const diffSsfContentV2 = (base: unknown, current: unknown): unknown => {
  if (Array.isArray(base) && Array.isArray(current)) return diffArray(base, current);
  if (isRecord(base) && isRecord(current)) return diffObject(base, current);
  return Object.is(base, current) ? undefined : current;
};

export const effectiveSsfRuntimeFieldsV2 = (template: unknown, overrides: unknown): SsfRuntimeContentV2Fields => {
  const merged = mergeSsfContentV2(template, overrides ?? undefined);
  if (!isRecord(merged)) throw new Error('ssf_v2_runtime_content_invalid');
  if (isRecord(merged['conversationContentStorage']) && merged['conversationContentStorage']['mode'] === 'disabled') {
    const storage = merged['conversationContentStorage'];
    const languages = merged['guestLanguages'];
    return ssfRuntimeContentV2FieldsSchema.parse({
      ...merged,
      conversationContentStorage: { ...storage, retentionHours: null },
      guestLanguages: Array.isArray(languages) ? languages.map((entry) => isRecord(entry) && isRecord(entry['guest'])
        ? { ...entry, guest: { ...entry['guest'], storageQuestionHtml: null } }
        : entry) : languages,
    });
  }
  return ssfRuntimeContentV2FieldsSchema.parse(merged);
};
