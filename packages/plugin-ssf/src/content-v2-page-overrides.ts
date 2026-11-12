/** Applies editor page ownership to the existing sparse tenant override model. */
import type { SsfTenantEditorPage } from './content-v2-editor-contracts.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
import { isSsfContentRecord as isRecord } from './content-v2-overrides.js';
import {
  equalSsfContent as equalContent,
  patchChangedSsfContent,
  setSsfSparsePath as setSparsePath,
  ssfContentPathValue as pathValue,
} from './content-v2-override-patch.js';

type Runtime = SsfRuntimeContentV2Fields;
type Raw = Record<string, unknown>;
type Path = readonly string[];
const recordingKeys = [
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
] as const;
const pagePaths: Readonly<Record<SsfTenantEditorPage, readonly Path[]>> = {
  appearance: [
    ['branding', 'logo'],
    ['branding', 'icon'],
    ...['headline', 'explanationHtml', 'callToAction'].map((key) => ['staff', 'dashboard', key]),
    ...['headline', 'green', 'yellow', 'red'].map((key) => ['staff', 'dashboard', 'load', key]),
    ['staff', 'newConversation', 'headline'],
    ['staff', 'newConversation', 'descriptionHtml'],
  ],
  languages: [['staff', 'locale']],
  feedback: [['staff', 'feedback']],
  recordings: [...recordingKeys.map((key) => ['recording', key]), ['legalTexts']],
};
const guestPaths: Readonly<Record<Exclude<SsfTenantEditorPage, 'recordings'>, readonly Path[]>> = {
  appearance: [['guest', 'explanationHtml']],
  feedback: [['feedback']],
  languages: [['nativeName'], ['staffName'], ['icon']],
};

const apply = (target: Raw, base: unknown, before: unknown, after: unknown, path: Path) => {
  const previous = pathValue(before, path);
  const next = pathValue(after, path);
  if (equalContent(previous, next)) return;
  const inherited = pathValue(base, path);
  setSparsePath(
    target,
    path,
    patchChangedSsfContent(inherited, previous, next, pathValue(target, path))
  );
};

const resetGuestIcon = (
  result: Raw,
  comparison: Runtime,
  template: Runtime,
  locale: string | undefined
) => {
  const inherited = template.guestLanguages.find((entry) => entry.locale === locale);
  const language = comparison.guestLanguages.find((entry) => entry.locale === locale);
  const entries = result['guestLanguages'];
  if (Array.isArray(entries)) {
    const stored = entries.find((entry: unknown) => isRecord(entry) && entry['locale'] === locale);
    if (isRecord(stored)) delete stored['icon'];
  }
  if (language && inherited) language.icon = inherited.icon;
};

const resetMedia = (
  page: SsfTenantEditorPage,
  result: Raw,
  comparison: Runtime,
  template: Runtime,
  path: Path
) => {
  if (
    page === 'appearance' &&
    path[0] === 'branding' &&
    (path[1] === 'logo' || path[1] === 'icon')
  ) {
    setSparsePath(result, path, undefined);
    comparison.branding[path[1]] = template.branding[path[1]];
  } else if (page === 'languages' && path[0] === 'guestLanguages' && path[2] === 'icon') {
    resetGuestIcon(result, comparison, template, path[1]);
  }
};

const applyRecording = (
  result: Raw,
  template: Runtime,
  baseline: Runtime,
  draft: Runtime,
  path: Path
) => {
  const key = path[1] as keyof NonNullable<Runtime['recording']>;
  const previous = baseline.recording?.[key];
  const next = draft.recording?.[key];
  if (equalContent(previous, next)) return;
  const inherited = template.recording?.[key];
  setSparsePath(
    result,
    path,
    key === 'enabled' ? next : next === null || equalContent(next, inherited) ? undefined : next
  );
};

const applyGuest = (
  page: Exclude<SsfTenantEditorPage, 'recordings'>,
  entries: Raw[],
  language: Runtime['guestLanguages'][number],
  comparison: Runtime,
  draft: Runtime
) => {
  const before = comparison.guestLanguages.find((entry) => entry.locale === language.locale);
  const after = draft.guestLanguages.find((entry) => entry.locale === language.locale);
  let override = entries.find((entry) => entry['locale'] === language.locale);
  const target = override ?? { locale: language.locale };
  if (page === 'languages' && Boolean(before) !== Boolean(after)) {
    if (after) delete target['enabled'];
    else target['enabled'] = false;
  }
  if (after)
    for (const path of guestPaths[page]) apply(target, language, before ?? language, after, path);
  if (!override && Object.keys(target).length > 1) {
    entries.push(target);
    override = target;
  }
  if (override && Object.keys(override).length === 1) entries.splice(entries.indexOf(override), 1);
};

/** No whole-effective-aggregate re-diff: other page values and explicit pins remain raw. */
export const projectSsfTenantPageOverrides = (
  page: SsfTenantEditorPage,
  template: Runtime,
  original: Raw | null,
  baseline: Runtime,
  draft: Runtime,
  resetMediaPaths: readonly Path[] = []
): Raw => {
  const result: Raw = structuredClone(original ?? {});
  const comparison = structuredClone(baseline);
  for (const path of resetMediaPaths) resetMedia(page, result, comparison, template, path);
  for (const path of pagePaths[page]) {
    if (path[0] === 'recording') applyRecording(result, template, baseline, draft, path);
    else apply(result, template, comparison, draft, path);
  }
  if (page === 'recordings') return result;
  const entries = Array.isArray(result['guestLanguages'])
    ? (structuredClone(result['guestLanguages']) as Raw[])
    : [];
  for (const language of template.guestLanguages)
    applyGuest(page, entries, language, comparison, draft);
  if (entries.length) result['guestLanguages'] = entries;
  else delete result['guestLanguages'];
  return result;
};
