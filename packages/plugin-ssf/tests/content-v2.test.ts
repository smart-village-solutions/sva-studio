import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  resolveSsfInstallationContentV2,
  resolveSsfRuntimeContentV2,
} from '../src/content-v2.js';
import {
  diffSsfContentV2, effectiveSsfRuntimeFieldsV2,
} from '../src/content-v2-overrides.js';

const readExample = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../../docs/api/${name}`, import.meta.url), 'utf8')) as Record<string, unknown>;

const template = (): Record<string, unknown> => {
  const fields = readExample('ssf-runtime-configuration-v2.example.json');
  delete fields['contractVersion'];
  delete fields['configurationRevision'];
  delete fields['tenant'];
  return fields;
};

const tenant = { id: 'tenant-kassel', displayName: 'Stadt Kassel', timeZone: 'Europe/Berlin' };

describe('SSF V2 content resolution', () => {
  it('revisions the effective installation content and removes executable HTML', () => {
    const fields = readExample('ssf-installation-content-v2.example.json');
    delete fields['contractVersion'];
    delete fields['configurationRevision'];
    const response = resolveSsfInstallationContentV2(fields);
    expect(response.contractVersion).toBe('2.0');
    expect(response.configurationRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);
    const changed = structuredClone(fields);
    const localization = changed['localization'] as Record<string, unknown>;
    const login = localization['login'] as Record<string, unknown>;
    login['descriptionHtml'] = '<p>Geändert</p><script>alert(1)</script>';
    const next = resolveSsfInstallationContentV2(changed);
    expect(next.localization.login.descriptionHtml).toBe('<p>Geändert</p>');
    expect(next.configurationRevision).not.toBe(response.configurationRevision);
  });

  it('inherits each field and preserves extra template questions', () => {
    const source = template();
    const staff = source['staff'] as Record<string, unknown>;
    const feedback = staff['feedback'] as Record<string, unknown>;
    const questions = feedback['questions'] as Record<string, unknown>[];
    questions.push({ id: 'additional', type: 'longText', question: 'Additional question?' });

    const baseline = resolveSsfRuntimeContentV2({ tenant, template: source, overrides: null });
    const changed = resolveSsfRuntimeContentV2({
      tenant,
      template: source,
      overrides: {
        staff: { feedback: { questions: [{ id: 'translationQuality', question: 'Neuer Text?' }] } },
      },
    });
    expect(changed.staff.feedback.questions[0]?.question).toBe('Neuer Text?');
    expect(changed.staff.feedback.questions.at(-1)?.id).toBe('additional');
    expect(changed.staff.dashboard).toEqual(baseline.staff.dashboard);
    expect(changed.configurationRevision).not.toBe(baseline.configurationRevision);
  });

  it('disables storage without returning the previous retention or consent questions', () => {
    const response = resolveSsfRuntimeContentV2({
      tenant,
      template: template(),
      overrides: { conversationContentStorage: { mode: 'disabled' } },
    });
    expect(response.conversationContentStorage).toEqual({ mode: 'disabled', retentionHours: null });
    expect(response.guestLanguages.every((language) => language.guest.storageQuestionHtml === null)).toBe(true);
  });

  it('rejects a tenant override that introduces another question ID', () => {
    expect(() => resolveSsfRuntimeContentV2({
      tenant,
      template: template(),
      overrides: { staff: { feedback: { questions: [{ id: 'unknown', question: 'Injected' }] } } },
    })).toThrow('ssf_v2_override_identity_unknown');
  });

  it('round-trips a field edit while retaining unknown questions and disabled languages', () => {
    const source = template();
    const staff = source['staff'] as Record<string, unknown>;
    const feedback = staff['feedback'] as Record<string, unknown>;
    (feedback['questions'] as Record<string, unknown>[]).push({
      id: 'futureQuestion', type: 'longText', question: 'Future question?',
    });
    const original = effectiveSsfRuntimeFieldsV2(source, {
      guestLanguages: [{ locale: 'tr', enabled: false }],
      conversationContentStorage: { mode: 'disabled' },
    });
    original.staff.dashboard.headline = 'Edited by tenant';
    const overrides = diffSsfContentV2(source, original);
    const again = effectiveSsfRuntimeFieldsV2(source, overrides);
    expect(again.staff.dashboard.headline).toBe('Edited by tenant');
    expect(again.staff.feedback.questions.at(-1)?.id).toBe('futureQuestion');
    expect(again.guestLanguages.some((language) => language.locale === 'tr')).toBe(false);
    expect(again.conversationContentStorage.retentionHours).toBeNull();
  });
});
