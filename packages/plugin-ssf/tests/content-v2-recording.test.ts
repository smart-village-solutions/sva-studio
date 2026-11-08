import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveRecordingRetentionHours, resolveSsfRecordingPolicy } from '../src/content-v2-recording.js';
import { diffSsfContentV2, effectiveSsfRuntimeFieldsV2 } from '../src/content-v2-overrides.js';
import { resolveSsfRuntimeContentV2 } from '../src/content-v2.js';
const policy = { legalBasis: 'consent', signature: 'optional', idCheck: 'off', verificationRequired: true,
  recoveryMode: 'standard', timestampAuthorityUrl: 'https://tsa.example.org/tsr', auditRetentionHours: 8760 };
const template = () => {
  const value = JSON.parse(readFileSync(new URL('../../../docs/api/ssf-runtime-configuration-v2.example.json', import.meta.url), 'utf8'));
  delete value.contractVersion; delete value.configurationRevision; delete value.tenant;
  return value;
};
const tenant = { id: 'synthetic', displayName: 'Synthetic tenant', timeZone: 'Europe/Berlin' };
describe('recording policy', () => {
  it('resolves bounded hours with tenant precedence and reset inheritance', () => {
    expect(resolveRecordingRetentionHours()).toBe(720);
    expect(resolveRecordingRetentionHours(1440)).toBe(1440);
    expect(resolveRecordingRetentionHours(1440, 240)).toBe(240);
    expect(resolveRecordingRetentionHours(1440, null)).toBe(1440);
    expect(resolveRecordingRetentionHours(8760)).toBe(8760);
    for (const invalid of [0, -1, 8761, 1.5, NaN, Infinity]) {
      expect(() => resolveRecordingRetentionHours(invalid)).toThrow();
      expect(() => resolveRecordingRetentionHours(720, invalid)).toThrow();
    }
  });
  it('never inherits enablement and rejects incomplete enabled policy', () => {
    expect(resolveSsfRecordingPolicy(undefined, undefined)).toBeUndefined();
    expect(resolveSsfRecordingPolicy({ ...policy, enabled: true }, undefined)?.enabled).toBe(false);
    expect(resolveSsfRecordingPolicy({ retentionHours: 720 }, undefined)).toBeUndefined();
    expect(() => resolveSsfRecordingPolicy(undefined, { enabled: true })).toThrow();
    expect(() => resolveSsfRecordingPolicy(policy, null)).toThrow();
    expect(() => resolveSsfRecordingPolicy({ ...policy, auditRetentionHours: 100 }, { enabled: true })).toThrow();
    expect(() => resolveSsfRecordingPolicy({ ...policy, timestampAuthorityUrl: 'http://tsa.example.org' }, {})).toThrow();
  });
  it('serializes policy independently of content suppression and editor diffs', () => {
    const source = { ...template(), recording: policy };
    const draft = effectiveSsfRuntimeFieldsV2(source, { recording: { enabled: true, retentionHours: 240 }, guestLanguages: [{ locale: 'tr', enabled: false }] });
    const stored = JSON.parse(JSON.stringify(diffSsfContentV2(source, draft)));
    const response = resolveSsfRuntimeContentV2({ tenant, template: source, overrides: stored });
    expect(response.recording).toMatchObject({ enabled: true, retentionHours: 240 });
    expect(response.guestLanguages.some(({ locale }) => locale === 'tr')).toBe(false);
    expect(effectiveSsfRuntimeFieldsV2(source, { recording: { enabled: false } }).recording?.enabled).toBe(false);
    expect(effectiveSsfRuntimeFieldsV2(template(), { recording: { ...policy, enabled: true } }).recording?.enabled).toBe(true);
  });
  it('revisions effective defaults while preserving explicit overrides', () => {
    const resolve = (hours: number, overrides: unknown) => resolveSsfRuntimeContentV2({ tenant, template: { ...template(), recording: { ...policy, retentionHours: hours } }, overrides });
    expect(resolve(720, null).configurationRevision).not.toBe(resolve(1440, null).configurationRevision);
    expect(resolve(720, { recording: { retentionHours: 240 } }).configurationRevision).toBe(resolve(1440, { recording: { retentionHours: 240 } }).configurationRevision);
    expect(resolve(1440, { recording: { retentionHours: null } }).recording?.retentionHours).toBe(1440);
  });
  it('persists complete recording text edits and explicit enablement matching the template', () => {
    const source = { ...template(), recording: { ...policy, enabled: true,
      texts: [{ locale: 'en', consentHtml: '<p>Synthetic consent</p>', resumePromptHtml: '<p>Synthetic resume</p>' }] } };
    const draft = effectiveSsfRuntimeFieldsV2(source, { recording: { enabled: true } });
    if (!draft.recording?.texts?.[0]) throw new Error('missing_test_text');
    draft.recording.texts[0].consentHtml = '<p>Edited synthetic consent</p>';
    const stored = JSON.parse(JSON.stringify(diffSsfContentV2(source, draft)));
    expect(resolveSsfRuntimeContentV2({ tenant, template: source, overrides: stored }).recording).toMatchObject({
      enabled: true, texts: [{ locale: 'en', consentHtml: '<p>Edited synthetic consent</p>', resumePromptHtml: '<p>Synthetic resume</p>' }],
    });
  });
  it('rejects conflicting explicitly configured audit retention in incomplete disabled drafts', () => {
    expect(() => resolveSsfRecordingPolicy({ retentionHours: 720, auditRetentionHours: 100 }, undefined)).toThrow();
  });
  it('ignores legacy ask input without migrating its retention', () => {
    const response = effectiveSsfRuntimeFieldsV2(template(), { conversationContentStorage: { mode: 'ask', retentionHours: 4320 } });
    expect(response.conversationContentStorage).toEqual({ mode: 'disabled', retentionHours: null });
    expect(response.guestLanguages.every(({ guest }) => guest.storageQuestionHtml === null)).toBe(true);
    expect(response.recording).toBeUndefined();
  });
});
