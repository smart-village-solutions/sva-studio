import { resolveSsfRecordingPolicy } from './content-v2-recording.js';
import {
  ssfRuntimeContentV2FieldsSchema,
  type SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';

export const isSsfContentRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalFields = new Set([
  'headline',
  'required',
  'minLabel',
  'maxLabel',
  'placeholder',
  'maxLength',
]);

export const ssfContentIdentity = (value: unknown): string | null => {
  if (!isSsfContentRecord(value)) return null;
  return typeof value['locale'] === 'string'
    ? value['locale']
    : typeof value['id'] === 'string'
      ? value['id']
      : null;
};

const mergeArray = (base: unknown[], overrides: unknown[]): unknown[] => {
  const indexed = new Map(overrides.map((entry) => [ssfContentIdentity(entry), entry]));
  if (indexed.has(null) || indexed.size !== overrides.length) {
    throw new Error('ssf_v2_override_identity_invalid');
  }
  for (const key of indexed.keys()) {
    if (!base.some((entry) => ssfContentIdentity(entry) === key)) {
      throw new Error('ssf_v2_override_identity_unknown');
    }
  }
  return base.flatMap((entry) => {
    const changed = indexed.get(ssfContentIdentity(entry));
    if (isSsfContentRecord(changed) && changed['enabled'] === false) return [];
    return [mergeSsfContentV2(entry, changed)];
  });
};

const mergeObject = (base: Record<string, unknown>, overrides: Record<string, unknown>) => {
  for (const key of Object.keys(overrides)) {
    if (
      !Object.prototype.hasOwnProperty.call(base, key) &&
      key !== 'enabled' &&
      !optionalFields.has(key) &&
      key !== 'icon' &&
      key !== 'legalTexts'
    ) {
      throw new Error('ssf_v2_override_field_unknown');
    }
  }
  return Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(overrides)])]
      .filter((key) => key !== 'enabled' && !(optionalFields.has(key) && overrides[key] === null))
      .map((key) => [key, mergeSsfContentV2(base[key], overrides[key])])
  );
};

/** Sparse tenant overrides use stable locale and question IDs. */
export const mergeSsfContentV2 = (base: unknown, overrides: unknown): unknown => {
  if (overrides === undefined) return base;
  if (overrides === null) return null;
  if (Array.isArray(base)) {
    if (!Array.isArray(overrides)) throw new Error('ssf_v2_override_array_invalid');
    return mergeArray(base, overrides);
  }
  if (isSsfContentRecord(base)) {
    if (!isSsfContentRecord(overrides)) throw new Error('ssf_v2_override_object_invalid');
    return mergeObject(base, overrides);
  }
  return overrides;
};

const diffArray = (base: unknown[], current: unknown[]): unknown => {
  const changes: Record<string, unknown>[] = [];
  for (const original of base) {
    const key = ssfContentIdentity(original);
    if (!key) throw new Error('ssf_v2_diff_identity_missing');
    const edited = current.find((entry) => ssfContentIdentity(entry) === key);
    const identityKey =
      isSsfContentRecord(original) && typeof original['locale'] === 'string' ? 'locale' : 'id';
    if (edited === undefined) {
      changes.push({ [identityKey]: key, enabled: false });
    } else {
      const difference = diffSsfContentV2(original, edited);
      if (isSsfContentRecord(difference) && Object.keys(difference).length > 0) {
        changes.push({ [identityKey]: key, ...difference });
      }
    }
  }
  if (
    current.some(
      (entry) =>
        !base.some((original) => ssfContentIdentity(original) === ssfContentIdentity(entry))
    )
  ) {
    throw new Error('ssf_v2_diff_identity_unknown');
  }
  return changes.length === 0 ? undefined : changes;
};

const diffRecording = (base: unknown, current: Record<string, unknown>): unknown => {
  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(current).filter(
      ([key, value]) =>
        key !== 'retentionHours' &&
        key !== 'enabled' &&
        JSON.stringify(value) !== JSON.stringify(isSsfContentRecord(base) ? base[key] : undefined)
    )
  );
  // Enablement is tenant-only, even when it happens to equal the installation value.
  if (typeof current['enabled'] === 'boolean') result['enabled'] = current['enabled'];
  if (current['retentionHours'] != null) result['retentionHours'] = current['retentionHours'];
  return Object.keys(result).length ? result : undefined;
};

const diffObject = (base: Record<string, unknown>, current: Record<string, unknown>): unknown => {
  const changes = Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(current)])].flatMap((key) => {
      const difference =
        key === 'recording' && isSsfContentRecord(current[key])
          ? diffRecording(base[key], current[key])
          : diffSsfContentV2(base[key], current[key]);
      return difference === undefined ? [] : [[key, difference]];
    })
  );
  return Object.keys(changes).length === 0 ? undefined : changes;
};

export const diffSsfContentV2 = (base: unknown, current: unknown): unknown => {
  if (base !== undefined && current === undefined) return null;
  if (Array.isArray(base) && Array.isArray(current)) return diffArray(base, current);
  if (isSsfContentRecord(base) && isSsfContentRecord(current)) return diffObject(base, current);
  return Object.is(base, current) ? undefined : current;
};

export const effectiveSsfRuntimeFieldsV2 = (
  template: unknown,
  overrides: unknown
): SsfRuntimeContentV2Fields => {
  const withoutRecording = (value: unknown): unknown =>
    isSsfContentRecord(value)
      ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'recording'))
      : value;
  const recording = resolveSsfRecordingPolicy(
    isSsfContentRecord(template) ? template['recording'] : undefined,
    isSsfContentRecord(overrides) ? overrides['recording'] : undefined
  );
  const merged = mergeSsfContentV2(
    withoutRecording(template),
    withoutRecording(overrides) ?? undefined
  );
  if (!isSsfContentRecord(merged)) throw new Error('ssf_v2_runtime_content_invalid');
  const languages = merged['guestLanguages'];
  return ssfRuntimeContentV2FieldsSchema.parse({
    ...merged,
    ...(recording ? { recording } : {}),
    conversationContentStorage: { mode: 'disabled', retentionHours: null },
    guestLanguages: Array.isArray(languages)
      ? languages.map((entry) =>
          isSsfContentRecord(entry) && isSsfContentRecord(entry['guest'])
            ? { ...entry, guest: { ...entry['guest'], storageQuestionHtml: null } }
            : entry
        )
      : languages,
  });
};
