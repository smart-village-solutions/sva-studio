import { projectSsfTenantPageOverrides } from '../src/content-v2-page-overrides.js';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { resolveSsfInstallationContentV2, resolveSsfRuntimeContentV2 } from '../src/content-v2.js';
import { diffSsfContentV2, effectiveSsfRuntimeFieldsV2 } from '../src/content-v2-overrides.js';

const readExample = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../../docs/api/${name}`, import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >;

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
    expect(
      response.guestLanguages.every((language) => language.guest.storageQuestionHtml === null)
    ).toBe(true);
  });

  it('rejects a tenant override that introduces another question ID', () => {
    expect(() =>
      resolveSsfRuntimeContentV2({
        tenant,
        template: template(),
        overrides: {
          staff: { feedback: { questions: [{ id: 'unknown', question: 'Injected' }] } },
        },
      })
    ).toThrow('ssf_v2_override_identity_unknown');
  });

  it('round-trips a field edit while retaining unknown questions and disabled languages', () => {
    const source = template();
    const staff = source['staff'] as Record<string, unknown>;
    const feedback = staff['feedback'] as Record<string, unknown>;
    (feedback['questions'] as Record<string, unknown>[]).push({
      id: 'futureQuestion',
      type: 'longText',
      question: 'Future question?',
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

  it('round-trips cleared inherited media and optional feedback fields', () => {
    const source = template();
    const branding = source['branding'] as Record<string, unknown>;
    branding['logo'] = { url: 'https://example.org/logo.svg', alternativeText: 'Logo' };
    const languages = source['guestLanguages'] as Record<string, unknown>[];
    const first = languages[0];
    if (!first) throw new Error('ssf_v2_test_language_missing');
    first['icon'] = { url: 'https://example.org/language.svg', alternativeText: 'Language' };

    const edited = effectiveSsfRuntimeFieldsV2(source, null);
    edited.branding.logo = null;
    const editedFirst = edited.guestLanguages[0];
    if (!editedFirst) throw new Error('ssf_v2_test_language_missing');
    editedFirst.icon = null;
    const longText = edited.staff.feedback.questions.find(
      (question) => question.id === 'improvementIdeas'
    );
    if (!longText || longText.type !== 'longText') throw new Error('ssf_v2_test_question_missing');
    delete longText.headline;
    delete longText.maxLength;

    const overrides = diffSsfContentV2(source, edited);
    const effective = effectiveSsfRuntimeFieldsV2(source, overrides);
    expect(effective.branding.logo).toBeNull();
    expect(effective.guestLanguages[0]?.icon).toBeNull();
    const effectiveLongText = effective.staff.feedback.questions.find(
      (question) => question.id === 'improvementIdeas'
    );
    expect(effectiveLongText?.headline).toBeUndefined();
    expect(
      effectiveLongText?.type === 'longText' ? effectiveLongText.maxLength : null
    ).toBeUndefined();
  });
});

describe('page-owned sparse overrides', () => {
  it('preserves explicit equal overrides and other guest fields when saving feedback', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    const raw = {
      staff: { dashboard: { headline: base.staff.dashboard.headline } },
      guestLanguages: [
        {
          locale: 'en',
          nativeName: 'Explicit English',
          guest: { explanationHtml: '<p>Own explanation</p>' },
        },
      ],
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const draft = structuredClone(before);
    draft.guestLanguages.find((entry) => entry.locale === 'en')!.feedback.headline =
      'Feedback changed';
    const result = projectSsfTenantPageOverrides('feedback', base, raw, before, draft);
    expect(result['staff']).toEqual(raw.staff);
    expect(result['guestLanguages']).toMatchObject([
      {
        locale: 'en',
        nativeName: 'Explicit English',
        guest: { explanationHtml: '<p>Own explanation</p>' },
        feedback: { headline: 'Feedback changed' },
      },
    ]);
  });
  it('preserves an equal explicit pin within the feedback object and question being edited', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    const raw = {
      staff: {
        feedback: {
          headline: base.staff.feedback.headline,
          questions: [
            {
              id: base.staff.feedback.questions[0]!.id,
              question: base.staff.feedback.questions[0]!.question,
            },
          ],
        },
      },
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const draft = structuredClone(before);
    draft.staff.feedback.button = 'New submit';
    draft.staff.feedback.questions[0]!.headline = 'Changed question heading';
    const result = projectSsfTenantPageOverrides('feedback', base, raw, before, draft);
    expect(result['staff']).toMatchObject({
      feedback: {
        headline: base.staff.feedback.headline,
        button: 'New submit',
        questions: [
          {
            id: base.staff.feedback.questions[0]!.id,
            question: base.staff.feedback.questions[0]!.question,
            headline: 'Changed question heading',
          },
        ],
      },
    });
  });

  it('removes only an edited/reset field and preserves hidden guest content on deactivation', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    const raw = {
      guestLanguages: [
        { locale: 'en', nativeName: 'Own name', guest: { explanationHtml: '<p>Own text</p>' } },
      ],
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const draft = structuredClone(before);
    draft.guestLanguages = draft.guestLanguages.filter((entry) => entry.locale !== 'en');
    const result = projectSsfTenantPageOverrides('languages', base, raw, before, draft);
    expect(result['guestLanguages']).toEqual([{ ...raw.guestLanguages[0], enabled: false }]);
  });
  it('clears the entire owned media override on explicit reset but preserves later edits', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    base.branding.logo = { url: 'https://example.org/template.svg', alternativeText: 'Same' };
    const raw = {
      branding: { logo: { url: 'https://example.org/own.svg', alternativeText: 'Same' } },
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const reset = structuredClone(before);
    reset.branding.logo = base.branding.logo;
    expect(
      projectSsfTenantPageOverrides('appearance', base, raw, before, reset, [['branding', 'logo']])
    ).toEqual({});
    const edited = structuredClone(reset);
    edited.branding.logo = { url: 'https://example.org/own.svg', alternativeText: 'Same' };
    expect(
      projectSsfTenantPageOverrides('appearance', base, raw, before, edited, [['branding', 'logo']])
    ).toEqual({ branding: { logo: { url: 'https://example.org/own.svg' } } });
  });
});

describe('page projection activation, inheritance and recording contracts', () => {
  it('resets a guest icon by locale while retaining that language metadata and authored content', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    const language = base.guestLanguages.find((entry) => entry.locale === 'en')!;
    language.icon = { url: 'https://example.org/inherited.svg', alternativeText: 'Same' };
    const raw = {
      guestLanguages: [
        {
          locale: 'en',
          nativeName: 'Pinned name',
          icon: { url: 'https://example.org/own.svg', alternativeText: 'Same' },
          guest: { explanationHtml: '<p>Keep me</p>' },
        },
      ],
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const draft = structuredClone(before);
    draft.guestLanguages.reverse();
    draft.guestLanguages.find((entry) => entry.locale === 'en')!.icon = language.icon;
    const result = projectSsfTenantPageOverrides('languages', base, raw, before, draft, [
      ['guestLanguages', 'en', 'icon'],
    ]);
    expect(result).toEqual({
      guestLanguages: [
        { locale: 'en', nativeName: 'Pinned name', guest: { explanationHtml: '<p>Keep me</p>' } },
      ],
    });
    expect(
      effectiveSsfRuntimeFieldsV2(base, result).guestLanguages.find(
        (entry) => entry.locale === 'en'
      )!.icon
    ).toEqual(language.icon);
    expect(raw.guestLanguages[0]!.icon.url).toBe('https://example.org/own.svg');
  });

  it('keeps guest media reset idempotent for already inherited and inactive languages', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    const noOverride = projectSsfTenantPageOverrides('languages', base, null, base, base, [
      ['guestLanguages', 'en', 'icon'],
    ]);
    expect(noOverride).toEqual({});
    const raw = {
      guestLanguages: [
        {
          locale: 'en',
          enabled: false,
          icon: { url: 'https://example.org/own.svg', alternativeText: 'Own' },
        },
      ],
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    expect(
      projectSsfTenantPageOverrides('languages', base, raw, before, before, [
        ['guestLanguages', 'en', 'icon'],
      ])
    ).toEqual({ guestLanguages: [{ locale: 'en', enabled: false }] });
  });

  it.each([false, true])(
    'reactivates a template language while preserving authored content=%s',
    (hasContent) => {
      const base = effectiveSsfRuntimeFieldsV2(template(), null);
      const entry = {
        locale: 'en',
        enabled: false,
        ...(hasContent ? { guest: { explanationHtml: '<p>Preserved hidden draft</p>' } } : {}),
      };
      const raw = { guestLanguages: [entry] };
      const before = effectiveSsfRuntimeFieldsV2(base, raw);
      const { enabled: _disabled, ...activeEntry } = entry;
      const draft = effectiveSsfRuntimeFieldsV2(base, { guestLanguages: [activeEntry] });
      const result = projectSsfTenantPageOverrides('languages', base, raw, before, draft);
      expect(result).toEqual(hasContent ? { guestLanguages: [activeEntry] } : {});
      expect(
        effectiveSsfRuntimeFieldsV2(base, result).guestLanguages.map(({ locale }) => locale)
      ).toContain('en');
      expect(raw.guestLanguages[0]!.enabled).toBe(false);
    }
  );

  it('removes only a reset staff field and follows future template changes', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    const raw = { staff: { locale: base.staff.locale, dashboard: { headline: 'Own headline' } } };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const draft = structuredClone(before);
    draft.staff.dashboard.headline = base.staff.dashboard.headline;
    const result = projectSsfTenantPageOverrides('appearance', base, raw, before, draft);
    expect(result).toEqual({ staff: { locale: base.staff.locale } });
    base.staff.dashboard.headline = 'Future template headline';
    expect(effectiveSsfRuntimeFieldsV2(base, result).staff.dashboard.headline).toBe(
      'Future template headline'
    );
  });

  it('preserves explicit tenant disablement and resets retention without touching other page values', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    base.recording = {
      enabled: false,
      legalBasis: 'consent',
      signature: 'off',
      idCheck: 'off',
      verificationRequired: false,
      recoveryMode: 'standard',
      retentionHours: 720,
      auditRetentionHours: 900,
      timestampAuthorityUrl: 'https://example.org/time',
    };
    const raw = {
      recording: { enabled: true, retentionHours: 48, auditRetentionHours: 900 },
      staff: { dashboard: { headline: 'Unrelated' } },
    };
    const before = effectiveSsfRuntimeFieldsV2(base, raw);
    const draft = structuredClone(before);
    draft.recording = {
      ...draft.recording,
      enabled: false,
      retentionHours: null,
      signature: 'required',
    };
    const result = projectSsfTenantPageOverrides('recordings', base, raw, before, draft);
    expect(result).toEqual({
      recording: { enabled: false, auditRetentionHours: 900, signature: 'required' },
      staff: raw.staff,
    });
    const effective = effectiveSsfRuntimeFieldsV2(base, result);
    expect(effective.recording).toMatchObject({
      enabled: false,
      retentionHours: 720,
      signature: 'required',
    });
  });

  it('stores incomplete disabled recording preparation without inventing an enabled runtime policy', () => {
    const base = effectiveSsfRuntimeFieldsV2(template(), null);
    delete base.recording;
    const draft = structuredClone(base);
    draft.recording = { enabled: false, legalBasis: 'consent', retentionHours: 48 };
    const result = projectSsfTenantPageOverrides('recordings', base, null, base, draft);
    expect(result).toEqual({ recording: draft.recording });
    expect(effectiveSsfRuntimeFieldsV2(base, result).recording).toBeUndefined();
  });
});
