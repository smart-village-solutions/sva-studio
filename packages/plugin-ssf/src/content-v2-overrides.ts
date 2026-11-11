import type { SsfTenantEditorPage } from './content-v2-admin-contracts.js';
import { resolveSsfRecordingPolicy } from './content-v2-recording.js';
import {
  ssfRuntimeContentV2FieldsSchema,
  type SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalFields = new Set([
  'headline',
  'required',
  'minLabel',
  'maxLabel',
  'placeholder',
  'maxLength',
]);

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
    const identityKey =
      isRecord(original) && typeof original['locale'] === 'string' ? 'locale' : 'id';
    if (edited === undefined) {
      changes.push({ [identityKey]: key, enabled: false });
    } else {
      const difference = diffSsfContentV2(original, edited);
      if (isRecord(difference) && Object.keys(difference).length > 0) {
        changes.push({ [identityKey]: key, ...difference });
      }
    }
  }
  if (
    current.some(
      (entry) => !base.some((original) => contentIdentity(original) === contentIdentity(entry))
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
        JSON.stringify(value) !== JSON.stringify(isRecord(base) ? base[key] : undefined)
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
        key === 'recording' && isRecord(current[key])
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
  if (isRecord(base) && isRecord(current)) return diffObject(base, current);
  return Object.is(base, current) ? undefined : current;
};

export const effectiveSsfRuntimeFieldsV2 = (
  template: unknown,
  overrides: unknown
): SsfRuntimeContentV2Fields => {
  const withoutRecording = (value: unknown): unknown =>
    isRecord(value)
      ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'recording'))
      : value;
  const recording = resolveSsfRecordingPolicy(
    isRecord(template) ? template['recording'] : undefined,
    isRecord(overrides) ? overrides['recording'] : undefined
  );
  const merged = mergeSsfContentV2(
    withoutRecording(template),
    withoutRecording(overrides) ?? undefined
  );
  if (!isRecord(merged)) throw new Error('ssf_v2_runtime_content_invalid');
  const languages = merged['guestLanguages'];
  return ssfRuntimeContentV2FieldsSchema.parse({
    ...merged,
    ...(recording ? { recording } : {}),
    conversationContentStorage: { mode: 'disabled', retentionHours: null },
    guestLanguages: Array.isArray(languages)
      ? languages.map((entry) =>
          isRecord(entry) && isRecord(entry['guest'])
            ? { ...entry, guest: { ...entry['guest'], storageQuestionHtml: null } }
            : entry
        )
      : languages,
  });
};

const equalContent = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
const pathValue = (value: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
const setSparsePath = (
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
  setSparsePath(nested, rest, value);
  if (Object.keys(nested).length) target[key] = nested;
  else delete target[key];
};

/** Preserve untouched explicit pins even inside an edited feedback/legal/media object. */
const patchChangedContent = (
  base: unknown,
  before: unknown,
  after: unknown,
  raw: unknown
): unknown => {
  if (equalContent(before, after)) return raw;
  if (isRecord(before) && isRecord(after)) {
    const next = isRecord(raw) ? structuredClone(raw) : {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const value = patchChangedContent(
        isRecord(base) ? base[key] : undefined,
        before[key],
        after[key],
        next[key]
      );
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    return Object.keys(next).length ? next : undefined;
  }
  if (Array.isArray(base) && Array.isArray(before) && Array.isArray(after)) {
    const entries: Record<string, unknown>[] = Array.isArray(raw) ? structuredClone(raw) : [];
    for (const original of base) {
      const identity = contentIdentity(original);
      if (!identity || !isRecord(original)) throw new Error('ssf_v2_diff_identity_missing');
      const identityKey = typeof original['locale'] === 'string' ? 'locale' : 'id';
      const previous = before.find((entry) => contentIdentity(entry) === identity);
      const current = after.find((entry) => contentIdentity(entry) === identity);
      if (equalContent(previous, current)) continue;
      const index = entries.findIndex((entry) => contentIdentity(entry) === identity);
      const existing = index >= 0 ? entries[index] : undefined;
      const changed =
        current === undefined
          ? { ...existing, [identityKey]: identity, enabled: false }
          : patchChangedContent(original, previous ?? original, current, existing);
      if (index >= 0) entries.splice(index, 1);
      if (isRecord(changed) && Object.keys(changed).some((key) => key !== identityKey))
        entries.push({ [identityKey]: identity, ...changed });
    }
    if (
      after.some(
        (entry) => !base.some((original) => contentIdentity(original) === contentIdentity(entry))
      )
    ) {
      throw new Error('ssf_v2_diff_identity_unknown');
    }
    return entries.length ? entries : undefined;
  }
  return equalContent(base, after) ? undefined : diffSsfContentV2(base, after);
};

/** Apply only edits belonging to this page; never re-diff the entire effective aggregate. */
export const projectSsfTenantPageOverrides = (
  page: SsfTenantEditorPage,
  template: SsfRuntimeContentV2Fields,
  original: Record<string, unknown> | null,
  baseline: SsfRuntimeContentV2Fields,
  draft: SsfRuntimeContentV2Fields,
  resetMediaPaths: readonly (readonly string[])[] = []
): Record<string, unknown> => {
  const result: Record<string, unknown> = structuredClone(original ?? {});
  const comparison = structuredClone(baseline);
  for (const path of resetMediaPaths) {
    if (
      page === 'appearance' &&
      path[0] === 'branding' &&
      (path[1] === 'logo' || path[1] === 'icon')
    ) {
      setSparsePath(result, path, undefined);
      comparison.branding[path[1]] = template.branding[path[1]];
    } else if (page === 'languages' && path[0] === 'guestLanguages' && path[2] === 'icon') {
      const locale = path[1];
      const inherited = template.guestLanguages.find((entry) => entry.locale === locale);
      const language = comparison.guestLanguages.find((entry) => entry.locale === locale);
      const entries = result['guestLanguages'];
      if (Array.isArray(entries)) {
        const stored = entries.find(
          (entry: unknown) => isRecord(entry) && entry['locale'] === locale
        );
        if (isRecord(stored)) delete stored['icon'];
      }
      if (language && inherited) language.icon = inherited.icon;
    }
  }

  const apply = (
    target: Record<string, unknown>,
    base: unknown,
    before: unknown,
    after: unknown,
    path: readonly string[]
  ) => {
    const previous = pathValue(before, path);
    const next = pathValue(after, path);
    if (equalContent(previous, next)) return;
    const inherited = pathValue(base, path);
    setSparsePath(
      target,
      path,
      patchChangedContent(inherited, previous, next, pathValue(target, path))
    );
  };
  const paths =
    page === 'appearance'
      ? [
          ['branding', 'logo'],
          ['branding', 'icon'],
          ...['headline', 'explanationHtml', 'callToAction'].map((key) => [
            'staff',
            'dashboard',
            key,
          ]),
          ...['headline', 'green', 'yellow', 'red'].map((key) => [
            'staff',
            'dashboard',
            'load',
            key,
          ]),
          ['staff', 'newConversation', 'headline'],
          ['staff', 'newConversation', 'descriptionHtml'],
        ]
      : page === 'languages'
        ? [['staff', 'locale']]
        : page === 'feedback'
          ? [['staff', 'feedback']]
          : [
              ...[
                'enabled',
                'legalBasis',
                'signature',
                'idCheck',
                'verificationRequired',
                'recoveryMode',
                'retentionHours',
                'auditRetentionHours',
                'timestampAuthorityUrl',
                'texts',
              ].map((key) => ['recording', key]),
              ['legalTexts'],
            ];
  for (const path of paths) {
    // Recording settings are a separate shallow override contract, not a merged locale collection.
    if (path[0] === 'recording') {
      const key = path[1]!;
      const previous = baseline.recording?.[key as keyof NonNullable<typeof baseline.recording>];
      const next = draft.recording?.[key as keyof NonNullable<typeof draft.recording>];
      if (!equalContent(previous, next)) {
        const inherited = template.recording?.[key as keyof NonNullable<typeof template.recording>];
        setSparsePath(
          result,
          path,
          key === 'enabled'
            ? next
            : next === null || equalContent(next, inherited)
              ? undefined
              : next
        );
      }
    } else apply(result, template, comparison, draft, path);
  }
  if (page === 'recordings') return result;
  const entries = Array.isArray(result['guestLanguages'])
    ? (structuredClone(result['guestLanguages']) as Record<string, unknown>[])
    : [];
  for (const language of template.guestLanguages) {
    const before = comparison.guestLanguages.find((entry) => entry.locale === language.locale);
    const after = draft.guestLanguages.find((entry) => entry.locale === language.locale);
    let override = entries.find((entry) => entry['locale'] === language.locale);
    const target = override ?? { locale: language.locale };
    if (page === 'languages' && Boolean(before) !== Boolean(after)) {
      if (after) delete target['enabled'];
      else target['enabled'] = false;
    }
    if (after) {
      const guestPaths =
        page === 'appearance'
          ? [['guest', 'explanationHtml']]
          : page === 'feedback'
            ? [['feedback']]
            : [['nativeName'], ['staffName'], ['icon']];
      for (const path of guestPaths) apply(target, language, before ?? language, after, path);
    }
    if (!override && Object.keys(target).length > 1) {
      entries.push(target);
      override = target;
    }
    if (override && Object.keys(override).length === 1)
      entries.splice(entries.indexOf(override), 1);
  }
  if (entries.length) result['guestLanguages'] = entries;
  else delete result['guestLanguages'];
  return result;
};
