import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ssfRuntimeContentV2FieldsSchema } from '../src/content-v2-contracts.js';
import { diffSsfContentV2, effectiveSsfRuntimeFieldsV2 } from '../src/content-v2-overrides.js';
import { resolveSsfRuntimeContentV2 } from '../src/content-v2.js';

const template = () => {
  const value = JSON.parse(readFileSync(new URL('../../../docs/api/ssf-runtime-configuration-v2.example.json', import.meta.url), 'utf8'));
  delete value.contractVersion; delete value.configurationRevision; delete value.tenant;
  delete value.legalTexts;
  return value;
};
const group = (name: string) => ({ headline: name, bodyHtml: `<p>${name}</p>`, acceptLabel: 'Accept', declineLabel: 'Decline' });
const localization = (locale: string) => ({
  locale, mode2Consent: group('Record selected sections'), mode3Consent: group('Quality only'),
  guestRecordingRelease: group('Guest release'), staffRecordingRelease: group('Staff release'),
  recordingStatus: { waiting: 'Waiting', running: 'Running', stopped: 'Stopped', renewedReleaseRequired: 'Release again' },
});
const legalTexts = () => ({ sourceLocale: 'de-DE', version: 'test-draft', localizations: [localization('de-DE'), localization('en')] });
const tenant = { id: 'tenant-kassel', displayName: 'Kassel', timeZone: 'Europe/Berlin' };

describe('localized SSF legal content', () => {
  it('keeps old content unchanged and resolves independent source-language legal groups', () => {
    const original = template();
    expect(ssfRuntimeContentV2FieldsSchema.parse(original)).not.toHaveProperty('legalTexts');
    const next = resolveSsfRuntimeContentV2({ tenant, template: { ...original, legalTexts: legalTexts() }, overrides: null });
    expect(next).toHaveProperty('legalTexts.sourceLocale', 'de-DE');
    expect(next).toHaveProperty('legalTexts.localizations.0.mode2Consent.bodyHtml', '<p>Record selected sections</p>');
    expect(next).toHaveProperty('legalTexts.localizations.0.mode3Consent.bodyHtml', '<p>Quality only</p>');
    expect(next.guestLanguages).toEqual(original.guestLanguages);
    expect(next.conversationContentStorage).toEqual(original.conversationContentStorage);
  });

  it('permits missing translations but rejects duplicate locales, unknown source and incomplete groups', () => {
    const legal = legalTexts();
    const partial = { ...localization('en'), mode2Consent: null, mode3Consent: null };
    expect(ssfRuntimeContentV2FieldsSchema.safeParse({ ...template(), legalTexts: { ...legal, localizations: [localization('de-DE'), partial] } }).success).toBe(true);
    for (const invalid of [
      { ...legal, localizations: [localization('de-DE'), localization('de-DE')] },
      { ...legal, sourceLocale: 'fr' },
      { ...legal, localizations: [{ ...localization('de-DE'), mode2Consent: { headline: 'Incomplete' } }] },
    ]) expect(ssfRuntimeContentV2FieldsSchema.safeParse({ ...template(), legalTexts: invalid }).success).toBe(false);
  });

  it('round-trips a sparse edit by locale and resets only that field', () => {
    const source = { ...template(), legalTexts: legalTexts() };
    const edited = structuredClone(source);
    edited.legalTexts.localizations.reverse();
    edited.legalTexts.localizations[1]!.mode2Consent.bodyHtml = '<p>Tenant wording</p>';
    const overrides = diffSsfContentV2(source, edited);
    expect(overrides).toEqual({ legalTexts: { localizations: [{ locale: 'de-DE', mode2Consent: { bodyHtml: '<p>Tenant wording</p>' } }] } });
    const effective = effectiveSsfRuntimeFieldsV2(source, overrides);
    expect(effective).toHaveProperty('legalTexts.localizations.0.mode2Consent.bodyHtml', '<p>Tenant wording</p>');
    expect(effective).toHaveProperty('legalTexts.localizations.0.mode3Consent.bodyHtml', '<p>Quality only</p>');
    expect(effectiveSsfRuntimeFieldsV2(source, {})).toHaveProperty('legalTexts.localizations.0.mode2Consent.bodyHtml', '<p>Record selected sections</p>');
    expect(source.legalTexts.localizations[0]!.mode2Consent.bodyHtml).toBe('<p>Record selected sections</p>');
  });

  it('allows adding legal content to an existing template without legal fields', () => {
    expect(effectiveSsfRuntimeFieldsV2(template(), { legalTexts: legalTexts() })).toHaveProperty('legalTexts.version', 'test-draft');
  });

  it('sanitizes every new HTML path and includes effective wording in the revision', () => {
    const source = { ...template(), legalTexts: legalTexts() };
    const baseline = resolveSsfRuntimeContentV2({ tenant, template: source, overrides: null });
    for (const key of ['mode2Consent', 'mode3Consent', 'guestRecordingRelease', 'staffRecordingRelease']) {
      const response = resolveSsfRuntimeContentV2({ tenant, template: source, overrides: {
        legalTexts: { localizations: [{ locale: 'de-DE', [key]: { bodyHtml: '<p onclick="bad()">Safe</p><script>bad()</script>' } }] },
      } });
      expect(response).toHaveProperty(`legalTexts.localizations.0.${key}.bodyHtml`, '<p>Safe</p>');
      expect(response.configurationRevision).not.toBe(baseline.configurationRevision);
    }
    expect(resolveSsfRuntimeContentV2({ tenant, template: source, overrides: {} }).configurationRevision).toBe(baseline.configurationRevision);
  });

  it('retains legal content when storage is disabled without altering the legacy consent', () => {
    const source = { ...template(), legalTexts: legalTexts() };
    const before = structuredClone(source.guestLanguages);
    const response = resolveSsfRuntimeContentV2({ tenant, template: source, overrides: { conversationContentStorage: { mode: 'disabled' } } });
    expect(response.conversationContentStorage).toEqual({ mode: 'disabled', retentionHours: null });
    expect(response).toHaveProperty('legalTexts', source.legalTexts);
    expect(source.guestLanguages).toEqual(before);
    expect(response.guestLanguages.every((entry) => entry.guest.storageQuestionHtml === null)).toBe(true);
  });
});
