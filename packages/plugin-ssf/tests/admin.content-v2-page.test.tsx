// @vitest-environment jsdom
/** User-facing page saves preserve other page owners and drafts across language/tab changes. */
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StudioEditorLeaveGuardProvider } from '@sva/studio-ui-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SsfTenantContentV2Page } from '../src/admin.content-v2-tenant-page.js';
import { SsfSystemContentV2Page } from '../src/admin.content-v2-page.js';
import { SsfContentConflictError, SsfRecordingPolicyConflictError } from '../src/admin-api.js';
import {
  ssfRuntimeContentV2FieldsSchema,
  ssfInstallationContentV2FieldsSchema,
} from '../src/content-v2-contracts.js';

const api = vi.hoisted(() => ({
  readSystem: vi.fn(),
  writeSystem: vi.fn(),
  readTenant: vi.fn(),
  writeTenant: vi.fn(),
}));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('../src/admin-api.js', async (original) => ({
  ...(await original<typeof import('../src/admin-api.js')>()),
  readSsfSystemContentV2: api.readSystem,
  writeSsfSystemContentV2: api.writeSystem,
  readSsfTenantContentV2: api.readTenant,
  writeSsfTenantContentV2: api.writeTenant,
}));
vi.mock('@sva/studio-ui-react', async (original) => ({
  ...(await original<typeof import('@sva/studio-ui-react')>()),
  RichTextHtmlEditor: ({
    id,
    value,
    disabled,
    onChange,
  }: {
    id: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
  }) => (
    <textarea
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));
const revision = `sha256:${'0'.repeat(64)}`;
const catalog = {
  languages: {
    de: { name: 'German', native: 'Deutsch' },
    en: { name: 'English', native: 'English' },
    ar: { name: 'Arabic', native: 'العربية' },
  },
  admin_default: 'de',
  popular: ['en', 'ar'],
};
const example = (name: string) => {
  const value = JSON.parse(readFileSync(resolve(process.cwd(), '../../docs/api', name), 'utf8'));
  delete value.contractVersion;
  delete value.configurationRevision;
  delete value.tenant;
  return value;
};
const runtime = () =>
  ssfRuntimeContentV2FieldsSchema.parse(example('ssf-runtime-configuration-v2.example.json'));
const installation = () =>
  ssfInstallationContentV2FieldsSchema.parse(example('ssf-installation-content-v2.example.json'));
const tenantView = () => ({
  runtimeTemplate: runtime(),
  overrides: {},
  supportedLanguages: catalog,
  contentRevision: revision,
});
const rootView = () => ({
  runtimeTemplate: runtime(),
  installation: installation(),
  supportedLanguages: catalog,
  contentRevision: revision,
});
const clickTab = (label: string) =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: label }), { button: 0, ctrlKey: false });

describe('SSF independently saved administration pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readTenant.mockResolvedValue(tenantView());
    api.readSystem.mockResolvedValue(rootView());
    api.writeTenant.mockImplementation(async (overrides) => ({ ...tenantView(), overrides }));
    api.writeSystem.mockImplementation(async (input) => ({
      ...rootView(),
      ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null)),
    }));
  });
  afterEach(cleanup);

  it.each(['discard', 'reload', 'reload-error'] as const)(
    'releases a retained in-flight-save draft after explicit %s and protects later edits',
    async (reset) => {
      const initial = tenantView();
      initial.runtimeTemplate.branding.logo = {
        url: 'https://example.org/original.svg',
        alternativeText: 'Logo',
      };
      const committed = {
        ...initial,
        overrides: { branding: { logo: { url: 'https://example.org/submitted.svg' } } },
      };
      api.readTenant.mockResolvedValueOnce(initial).mockResolvedValue(committed);
      let finishSave: ((value: typeof committed) => void) | undefined;
      api.writeTenant.mockReturnValue(
        new Promise((resolve) => {
          finishSave = resolve;
        })
      );
      let check = () => false;
      render(
        <StudioEditorLeaveGuardProvider
          register={(next) => {
            check = next;
            return () => undefined;
          }}
        >
          <SsfTenantContentV2Page page="appearance" canManage />
        </StudioEditorLeaveGuardProvider>
      );
      const logo = await screen.findByRole('textbox', { name: 'v2.logoUrl' });
      fireEvent.change(logo, { target: { value: 'https://example.org/submitted.svg' } });
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
      // Simulate a late editor transaction arriving after the submitted snapshot.
      fireEvent.change(logo, { target: { value: 'https://example.org/later.svg' } });
      await act(async () => finishSave?.(committed));
      await screen.findByText('administration.conflict');
      expect(check()).toBe(true);
      if (reset === 'reload-error') api.readTenant.mockRejectedValueOnce(new Error('offline'));
      fireEvent.click(
        screen.getByRole('button', {
          name: reset === 'discard' ? 'actions.discard' : 'administration.reloadDiscard',
        })
      );
      if (reset === 'reload-error') {
        await screen.findByText('status.saveError');
        expect(check()).toBe(true);
        expect(screen.getByRole('textbox', { name: 'v2.logoUrl' })).toHaveProperty(
          'value',
          'https://example.org/later.svg'
        );
        fireEvent.click(screen.getByRole('button', { name: 'actions.discard' }));
      }
      await waitFor(() => expect(check()).toBe(false));
      const current = screen.getByRole('textbox', { name: 'v2.logoUrl' });
      expect(current).toHaveProperty(
        'value',
        reset === 'reload'
          ? 'https://example.org/submitted.svg'
          : 'https://example.org/original.svg'
      );
      fireEvent.change(current, { target: { value: 'https://example.org/next.svg' } });
      expect(check()).toBe(true);
    }
  );

  it('saves Appearance without changing explicit other-page overrides', async () => {
    const view = tenantView();
    view.overrides = { staff: { feedback: { headline: 'Own feedback' } } };
    api.readTenant.mockResolvedValue(view);
    render(<SsfTenantContentV2Page page="appearance" canManage />);
    await screen.findByRole('tab', { name: 'administration.sections.staff' });
    clickTab('administration.sections.staff');
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.dashboardHeadline' }), {
      target: { value: 'New headline' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() =>
      expect(api.writeTenant).toHaveBeenCalledWith(
        {
          staff: {
            feedback: { headline: 'Own feedback' },
            dashboard: { headline: 'New headline' },
          },
        },
        revision
      )
    );
    expect(screen.queryByLabelText('v2.recording.enabled')).toBeNull();
  });

  it('keeps guest drafts across language and tab changes and Discard resets all of them', async () => {
    render(<SsfTenantContentV2Page page="appearance" canManage />);
    await screen.findByRole('tab', { name: 'administration.sections.guests' });
    clickTab('administration.sections.guests');
    const selector = screen.getByRole('combobox', { name: 'administration.languageVersion' });
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.guestExplanation' }), {
      target: { value: '<p>First draft</p>' },
    });
    fireEvent.change(selector, { target: { value: 'tr' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.guestExplanation' }), {
      target: { value: '<p>Second draft</p>' },
    });
    clickTab('administration.sections.staff');
    clickTab('administration.sections.guests');
    expect(
      (screen.getByRole('textbox', { name: 'v2.guestExplanation' }) as HTMLTextAreaElement).value
    ).toBe('<p>Second draft</p>');
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeTenant).toHaveBeenCalled());
    expect(api.writeTenant.mock.calls[0]?.[0].guestLanguages).toEqual(
      expect.arrayContaining([
        { locale: 'en', guest: { explanationHtml: '<p>First draft</p>' } },
        { locale: 'tr', guest: { explanationHtml: '<p>Second draft</p>' } },
      ])
    );
    await screen.findByText('status.saved');
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.guestExplanation' }), {
      target: { value: '<p>Discard me</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.discard' }));
    clickTab('administration.sections.guests');
    expect(
      (screen.getByRole('textbox', { name: 'v2.guestExplanation' }) as HTMLTextAreaElement).value
    ).toBe('<p>First draft</p>');
  });

  it('retains a stale draft, reports conflict and never silently reloads it', async () => {
    api.writeTenant.mockRejectedValue(new SsfContentConflictError());
    render(<SsfTenantContentV2Page page="appearance" canManage />);
    await screen.findByRole('tab', { name: 'administration.sections.staff' });
    clickTab('administration.sections.staff');
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.dashboardHeadline' }), {
      target: { value: 'Keep my draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await screen.findByText('administration.conflict');
    expect(
      (screen.getByRole('textbox', { name: 'v2.dashboardHeadline' }) as HTMLInputElement).value
    ).toBe('Keep my draft');
    expect(api.readTenant).toHaveBeenCalledTimes(1);
  });

  it('keeps read-only access and separates Languages from guest explanation/feedback', async () => {
    render(<SsfTenantContentV2Page page="languages" canManage={false} />);
    const staffLocale = await screen.findByRole('combobox', { name: 'v2.locale' });
    expect((staffLocale as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'actions.save' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'v2.guestExplanation' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'v2.formHeadline' })).toBeNull();
  });

  it('commits both Default content tabs together without a default-configuration editor', async () => {
    render(<SsfSystemContentV2Page page="default-content" />);
    const headline = await screen.findByRole('textbox', { name: 'v2.loginHeadline' });
    fireEvent.change(headline, { target: { value: 'Installation login' } });
    clickTab('v2.template');
    clickTab('administration.sections.staff');
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.dashboardHeadline' }), {
      target: { value: 'Template dashboard' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeSystem).toHaveBeenCalled());
    expect(api.writeSystem.mock.calls[0]?.[0]).toMatchObject({
      installation: { localization: { login: { headline: 'Installation login' } } },
      runtimeTemplate: { staff: { dashboard: { headline: 'Template dashboard' } } },
    });
    expect(screen.queryByRole('checkbox', { name: 'v2.recording.enabled' })).toBeNull();
  });

  it('offers root technical settings without a tenant activation control', async () => {
    render(<SsfSystemContentV2Page page="default-configuration" />);
    await screen.findByRole('tab', { name: 'administration.sections.retention' });
    clickTab('administration.sections.retention');
    expect(screen.getByRole('spinbutton', { name: 'v2.recording.retentionHours' })).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'v2.recording.timestampAuthorityUrl' })
    ).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'v2.recording.enabled' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'v2.dashboardHeadline' })).toBeNull();
  });

  it('distinguishes load failures from an unconfigured template on Overview', async () => {
    api.readTenant.mockRejectedValueOnce(new Error('unavailable'));
    render(<SsfTenantContentV2Page page="overview" canManage={false} />);
    await screen.findByRole('button', { name: 'status.loadError' });
    expect(screen.queryByText('v2.notConfigured')).toBeNull();
    api.readTenant.mockResolvedValueOnce({ ...tenantView(), runtimeTemplate: null });
    fireEvent.click(screen.getByRole('button', { name: 'status.loadError' }));
    await screen.findByText('v2.notConfigured');
  });
  it('captures required texts when creating a new template language, then removes the creation-only editor', async () => {
    render(<SsfSystemContentV2Page page="default-configuration" />);
    const choose = await screen.findByRole('combobox', { name: 'v2.newLanguage' });
    fireEvent.change(choose, { target: { value: 'ar' } });
    fireEvent.click(screen.getByRole('button', { name: 'v2.addLanguage' }));
    expect((screen.getByRole('textbox', { name: 'v2.nativeName' }) as HTMLInputElement).value).toBe(
      'العربية'
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.guestExplanation' }), {
      target: { value: '<p>Guest explanation</p>' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.formHeadline' }), {
      target: { value: 'New form' },
    });
    for (const field of screen.getAllByLabelText('v2.questionText'))
      fireEvent.change(field, { target: { value: 'Required question' } });
    fireEvent.change(screen.getByLabelText('v2.notice'), { target: { value: '<p>Notice</p>' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'v2.button' }), {
      target: { value: 'Send' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await screen.findByText('status.saved');
    expect(api.writeSystem.mock.calls[0]?.[0].runtimeTemplate.guestLanguages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'ar',
          nativeName: 'العربية',
          guest: { explanationHtml: '<p>Guest explanation</p>', storageQuestionHtml: null },
        }),
      ])
    );
    expect(screen.queryByRole('textbox', { name: 'v2.guestExplanation' })).toBeNull();
  });

  it('shows effective saved retention on Overview instead of the editable reset marker', async () => {
    const view = tenantView();
    view.runtimeTemplate.recording = {
      enabled: false,
      legalBasis: 'consent',
      signature: 'off',
      idCheck: 'off',
      retentionHours: 48,
      verificationRequired: false,
      recoveryMode: 'standard',
      timestampAuthorityUrl: 'https://tsa.example.org',
      auditRetentionHours: 8760,
    };
    api.readTenant.mockResolvedValue(view);
    render(<SsfTenantContentV2Page page="overview" canManage={false} />);
    await screen.findByText('v2.recording.effectiveRetention: 48');
  });

  it('keeps tenant activation off independently of a root enabled value and rejects incomplete activation', async () => {
    const view = tenantView();
    view.runtimeTemplate.recording = { enabled: true, retentionHours: 720 };
    api.readTenant.mockResolvedValue(view);
    render(<SsfTenantContentV2Page page="recordings" canManage />);
    const enabled = (await screen.findByRole('checkbox', {
      name: 'v2.recording.enabled',
    })) as HTMLInputElement;
    expect(enabled.checked).toBe(false);
    fireEvent.click(enabled);
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await screen.findByText('v2.invalid');
    expect(api.writeTenant).not.toHaveBeenCalled();
  });

  it('resets only tenant retention while preserving explicit activation', async () => {
    const view = tenantView();
    view.runtimeTemplate.recording = {
      legalBasis: 'consent',
      signature: 'off',
      idCheck: 'off',
      retentionHours: 48,
      verificationRequired: false,
      recoveryMode: 'standard',
      timestampAuthorityUrl: 'https://tsa.example.org',
      auditRetentionHours: 8760,
    };
    view.overrides = { recording: { enabled: true, retentionHours: 24 } };
    api.readTenant.mockResolvedValue(view);
    render(<SsfTenantContentV2Page page="recordings" canManage />);
    await screen.findByRole('tab', { name: 'administration.sections.retention' });
    clickTab('administration.sections.retention');
    fireEvent.click(screen.getByRole('button', { name: 'v2.recording.resetRetention' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() =>
      expect(api.writeTenant).toHaveBeenCalledWith({ recording: { enabled: true } }, revision)
    );
  });

  it('keeps incomplete recording rows attached to their drafts and saves all surviving locales', async () => {
    const view = tenantView();
    const savedText = {
      locale: 'de',
      consentHtml: '<p>Saved consent</p>',
      resumePromptHtml: '<p>Saved resume</p>',
    };
    view.runtimeTemplate.recording = { enabled: false, texts: [savedText] };
    view.overrides = { staff: { feedback: { headline: 'Keep unrelated feedback' } } };
    api.readTenant.mockResolvedValue(view);
    api.writeTenant.mockImplementation(async (overrides) => ({ ...view, overrides }));
    render(<SsfTenantContentV2Page page="recordings" canManage />);
    await screen.findByRole('tab', { name: 'administration.sections.wording' });
    clickTab('administration.sections.wording');
    const wording = within(
      screen.getByRole('heading', { name: 'administration.recordingWording' }).closest('section')!
    );
    const selector = wording.getByRole('combobox', {
      name: 'administration.languageVersion',
    }) as HTMLSelectElement;
    const savedId = selector.value;
    fireEvent.click(wording.getByRole('button', { name: 'v2.recording.addText' }));
    const englishId = selector.value;
    fireEvent.change(wording.getByLabelText('v2.locale'), { target: { value: 'en' } });
    fireEvent.change(wording.getByLabelText('v2.recording.consentHtml'), {
      target: { value: '<p>English consent draft</p>' },
    });
    fireEvent.change(wording.getByLabelText('v2.recording.resumePromptHtml'), {
      target: { value: '<p>English resume draft</p>' },
    });
    fireEvent.click(wording.getByRole('button', { name: 'v2.recording.addText' }));
    const unfinishedId = selector.value;
    expect(new Set([savedId, englishId, unfinishedId]).size).toBe(3);
    expect(
      wording.getByRole('option', { name: 'administration.unfinishedLanguage' })
    ).toHaveProperty('selected', true);
    fireEvent.change(wording.getByLabelText('v2.recording.consentHtml'), {
      target: { value: '<p>Unfinished consent</p>' },
    });
    fireEvent.change(wording.getByLabelText('v2.recording.resumePromptHtml'), {
      target: { value: '<p>Unfinished resume</p>' },
    });
    const save = screen.getByRole('button', { name: 'actions.save' });
    fireEvent.click(save);
    await screen.findByText('v2.invalid', { selector: '[role="status"]' });
    expect(api.writeTenant).not.toHaveBeenCalled();
    expect(selector.value).toBe(unfinishedId);
    expect(wording.getByLabelText('v2.locale')).toHaveProperty('value', '');
    fireEvent.change(selector, { target: { value: savedId } });
    expect(wording.getByLabelText('v2.recording.consentHtml')).toHaveProperty(
      'value',
      savedText.consentHtml
    );
    fireEvent.change(selector, { target: { value: englishId } });
    expect(wording.getByLabelText('v2.locale')).toHaveProperty('value', 'en');
    expect(wording.getByLabelText('v2.recording.consentHtml')).toHaveProperty(
      'value',
      '<p>English consent draft</p>'
    );
    fireEvent.change(selector, { target: { value: unfinishedId } });
    expect(wording.getByLabelText('v2.recording.resumePromptHtml')).toHaveProperty(
      'value',
      '<p>Unfinished resume</p>'
    );
    fireEvent.click(wording.getByRole('button', { name: 'v2.recording.removeText' }));
    expect(wording.queryByRole('option', { name: 'administration.unfinishedLanguage' })).toBeNull();
    fireEvent.change(selector, { target: { value: englishId } });
    expect(wording.getByLabelText('v2.recording.resumePromptHtml')).toHaveProperty(
      'value',
      '<p>English resume draft</p>'
    );
    fireEvent.click(save);
    await waitFor(() =>
      expect(api.writeTenant).toHaveBeenCalledWith(
        {
          staff: { feedback: { headline: 'Keep unrelated feedback' } },
          recording: {
            texts: [
              savedText,
              {
                locale: 'en',
                consentHtml: '<p>English consent draft</p>',
                resumePromptHtml: '<p>English resume draft</p>',
              },
            ],
          },
        },
        revision
      )
    );
    await screen.findByText('status.saved');
  });

  it('retains guest metadata drafts across activation changes and resets only the guest icon', async () => {
    const view = tenantView();
    view.runtimeTemplate.guestLanguages = view.runtimeTemplate.guestLanguages.slice(0, 2);
    const english = view.runtimeTemplate.guestLanguages[0]!;
    const other = view.runtimeTemplate.guestLanguages[1]!;
    const templateIcon = {
      url: 'https://example.org/template-language.svg',
      alternativeText: 'Template language icon',
    };
    english.icon = templateIcon;
    view.overrides = {
      staff: { feedback: { headline: 'Keep staff feedback' } },
      guestLanguages: [
        {
          locale: english.locale,
          icon: { url: 'https://example.org/own-language.svg', alternativeText: 'Own icon' },
          guest: { explanationHtml: '<p>Keep guest explanation</p>' },
        },
      ],
    };
    api.readTenant.mockResolvedValue(view);
    api.writeTenant.mockImplementation(async (overrides) => ({ ...view, overrides }));
    render(<SsfTenantContentV2Page page="languages" canManage />);
    const englishToggle = await screen.findByRole('checkbox', {
      name: `${english.nativeName} (${english.locale})`,
    });
    const otherToggle = screen.getByRole('checkbox', {
      name: `${other.nativeName} (${other.locale})`,
    });
    fireEvent.change(screen.getByLabelText('v2.nativeName'), {
      target: { value: 'Edited English name' },
    });
    fireEvent.change(screen.getByLabelText('v2.iconUrl'), {
      target: { value: 'https://example.org/draft-language.svg' },
    });
    fireEvent.change(screen.getByLabelText('v2.alternativeText'), {
      target: { value: 'Draft icon text' },
    });
    fireEvent.click(englishToggle);
    expect(otherToggle).toHaveProperty('disabled', true);
    const selector = screen.getByRole('combobox', { name: 'administration.languageVersion' });
    expect(selector).toHaveProperty('value', other.locale);
    expect(
      screen.queryByRole('option', { name: `Edited English name (${english.locale})` })
    ).toBeNull();
    fireEvent.click(englishToggle);
    expect(otherToggle).toHaveProperty('disabled', false);
    fireEvent.change(selector, { target: { value: english.locale } });
    expect(screen.getByLabelText('v2.nativeName')).toHaveProperty('value', 'Edited English name');
    expect(screen.getByLabelText('v2.iconUrl')).toHaveProperty(
      'value',
      'https://example.org/draft-language.svg'
    );
    expect(screen.getByLabelText('v2.alternativeText')).toHaveProperty('value', 'Draft icon text');
    fireEvent.change(screen.getByLabelText('v2.iconUrl'), { target: { value: '' } });
    expect(screen.queryByLabelText('v2.alternativeText')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'fields.inherit' }).at(-1)!);
    expect(screen.getByLabelText('v2.iconUrl')).toHaveProperty('value', templateIcon.url);
    expect(screen.getByLabelText('v2.alternativeText')).toHaveProperty(
      'value',
      templateIcon.alternativeText
    );
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() =>
      expect(api.writeTenant).toHaveBeenCalledWith(
        {
          staff: { feedback: { headline: 'Keep staff feedback' } },
          guestLanguages: [
            {
              locale: english.locale,
              guest: { explanationHtml: '<p>Keep guest explanation</p>' },
              nativeName: 'Edited English name',
            },
          ],
        },
        revision
      )
    );
    await screen.findByText('status.saved');
    expect(englishToggle).toHaveProperty('checked', true);
    expect(otherToggle).toHaveProperty('checked', true);
  });

  it('rejects out-of-range root retention without truncation', async () => {
    render(<SsfSystemContentV2Page page="default-configuration" />);
    await screen.findByRole('tab', { name: 'administration.sections.retention' });
    clickTab('administration.sections.retention');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'v2.recording.retentionHours' }), {
      target: { value: '8761' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeSystem).not.toHaveBeenCalled());
    expect(
      (screen.getByRole('spinbutton', { name: 'v2.recording.retentionHours' }) as HTMLInputElement)
        .value
    ).toBe('8761');
  });

  it('retains a root policy draft and names affected tenants after a rejected write', async () => {
    api.writeSystem.mockRejectedValue(new SsfRecordingPolicyConflictError(['synthetic-alpha']));
    render(<SsfSystemContentV2Page page="default-configuration" />);
    await screen.findByRole('tab', { name: 'administration.sections.retention' });
    clickTab('administration.sections.retention');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'v2.recording.retentionHours' }), {
      target: { value: '48' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await screen.findByText('synthetic-alpha');
    expect(
      (screen.getByRole('spinbutton', { name: 'v2.recording.retentionHours' }) as HTMLInputElement)
        .value
    ).toBe('48');
  });

  it('keeps text editing and disables language membership changes when the catalogue is unavailable', async () => {
    api.readTenant.mockResolvedValue({ ...tenantView(), supportedLanguages: null });
    render(<SsfTenantContentV2Page page="languages" canManage />);
    const locale = (await screen.findByRole('combobox', {
      name: 'v2.locale',
    })) as HTMLSelectElement;
    expect(locale.disabled).toBe(true);
    expect(
      screen.getAllByRole('checkbox').every((field) => (field as HTMLInputElement).disabled)
    ).toBe(true);
    expect(
      (screen.getByRole('textbox', { name: 'v2.nativeName' }) as HTMLInputElement).disabled
    ).toBe(false);
  });

  it('clears an optional feedback length and retains a supported uneditable question', async () => {
    const view = tenantView();
    view.runtimeTemplate.staff.feedback.questions.push({
      id: 'additional',
      type: 'longText',
      question: 'Keep this',
    });
    api.readTenant.mockResolvedValue(view);
    render(<SsfTenantContentV2Page page="feedback" canManage />);
    const length = (await screen.findAllByLabelText('v2.maxLength')).find(
      (node) => !node.closest('[hidden]')
    )!;
    fireEvent.change(length, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeTenant).toHaveBeenCalled());
    const question = api.writeTenant.mock.calls[0]?.[0].staff.feedback.questions[0];
    expect(question).toEqual({ id: 'improvementIdeas', maxLength: null });
    expect(api.writeTenant.mock.calls[0]?.[0].staff.feedback.questions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'additional' })])
    );
  });

  it('exposes and focuses a failed question in a hidden feedback language', async () => {
    render(<SsfTenantContentV2Page page="feedback" canManage />);
    await screen.findByRole('tab', { name: 'administration.sections.guests' });
    clickTab('administration.sections.guests');
    const field = screen
      .getAllByLabelText('v2.questionText')
      .find((node) => !node.closest('[hidden]')) as HTMLInputElement;
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'administration.languageVersion' }), {
      target: { value: 'tr' },
    });
    clickTab('administration.sections.staff');
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect((document.activeElement as HTMLInputElement).value).toBe(''));
    expect(screen.getByRole('combobox', { name: 'administration.languageVersion' })).toHaveProperty(
      'value',
      'en'
    );
    expect(document.activeElement?.closest('details')?.open).toBe(true);
    expect(api.writeTenant).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox', { name: 'administration.languageVersion' }), {
      target: { value: 'tr' },
    });
    const otherQuestion = screen
      .getAllByLabelText('v2.questionText')
      .find((node) => !node.closest('[hidden]'))!;
    fireEvent.change(otherQuestion, { target: { value: 'Keep editing this language' } });
    expect(screen.getByRole('combobox', { name: 'administration.languageVersion' })).toHaveProperty(
      'value',
      'tr'
    );
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'administration.languageVersion' })
      ).toHaveProperty('value', 'en')
    );
    expect(api.writeTenant).not.toHaveBeenCalled();
  });

  it('respects root language and tab choices after legal validation until the next save', async () => {
    const view = rootView();
    const consent = {
      headline: 'Consent',
      bodyHtml: '<p>Consent body</p>',
      acceptLabel: 'Yes',
      declineLabel: 'No',
    };
    const sourceLocale = view.runtimeTemplate.legalTexts!.sourceLocale;
    // This regression needs two legal locales and one staff field. Keep all other
    // aggregate data valid without mounting unrelated question/consent editors.
    view.installation.localization.feedback.questions =
      view.installation.localization.feedback.questions.slice(0, 1);
    view.runtimeTemplate.staff.feedback.questions =
      view.runtimeTemplate.staff.feedback.questions.slice(0, 1);
    view.runtimeTemplate.guestLanguages = view.runtimeTemplate.guestLanguages.slice(0, 1);
    view.runtimeTemplate.guestLanguages[0]!.feedback.questions =
      view.runtimeTemplate.guestLanguages[0]!.feedback.questions.slice(0, 1);
    view.runtimeTemplate.legalTexts!.localizations = [sourceLocale, 'en'].map((locale) => ({
      locale,
      mode2Consent: { ...consent },
      mode3Consent: null,
      guestRecordingRelease: null,
      staffRecordingRelease: null,
      recordingStatus: null,
    }));
    if (view.runtimeTemplate.recording) view.runtimeTemplate.recording.texts = [];
    api.readSystem.mockResolvedValue(view);
    render(<SsfSystemContentV2Page page="default-content" />);
    const templateTab = await screen.findByRole('tab', { name: 'v2.template' });
    fireEvent.mouseDown(templateTab, { button: 0, ctrlKey: false });
    const wordingTab = screen.getByRole('tab', { name: 'administration.sections.wording' });
    const staffTab = screen.getByRole('tab', { name: 'administration.sections.staff' });
    fireEvent.mouseDown(wordingTab, { button: 0, ctrlKey: false });
    const wording = within(
      screen.getByRole('tabpanel', { name: 'administration.sections.wording' })
    );
    const visibleHeadline = () =>
      wording
        .getAllByLabelText('v2.legalTexts.headline')
        .find((node) => !node.closest('[hidden]'))!;
    fireEvent.change(visibleHeadline(), { target: { value: '' } });
    const save = screen.getByRole('button', { name: 'actions.save' });
    fireEvent.click(save);
    await waitFor(() => expect(document.activeElement).toHaveProperty('value', ''));
    const selector = wording.getByRole('combobox', { name: 'administration.languageVersion' });
    fireEvent.change(selector, { target: { value: 'en' } });
    fireEvent.change(visibleHeadline(), { target: { value: 'English edit' } });
    expect(selector).toHaveProperty('value', 'en');
    fireEvent.mouseDown(staffTab, { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText('v2.dashboardHeadline'), {
      target: { value: 'Continue on another tab' },
    });
    expect(staffTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(save);
    await waitFor(() => expect(wordingTab.getAttribute('aria-selected')).toBe('true'));
    expect(selector).toHaveProperty('value', sourceLocale);
    expect(api.writeSystem).not.toHaveBeenCalled();
  });

  it('keeps legal source and localisation membership separate from guest languages', async () => {
    render(<SsfSystemContentV2Page page="default-content" />);
    await screen.findByRole('tab', { name: 'v2.template' });
    clickTab('v2.template');
    clickTab('administration.sections.wording');
    expect(
      (screen.getByRole('combobox', { name: 'v2.legalTexts.sourceLocale' }) as HTMLSelectElement)
        .value
    ).toBe('de-DE');
    fireEvent.change(screen.getByRole('combobox', { name: 'v2.legalTexts.newLanguage' }), {
      target: { value: 'ar' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'v2.legalTexts.addLanguage' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeSystem).toHaveBeenCalled());
    const next = api.writeSystem.mock.calls[0]?.[0].runtimeTemplate;
    expect(next.legalTexts.localizations).toEqual(
      expect.arrayContaining([expect.objectContaining({ locale: 'ar', mode2Consent: null })])
    );
    expect(next.guestLanguages.map((entry: { locale: string }) => entry.locale)).not.toContain(
      'ar'
    );
  });
  it('propagates an explicit whole-logo reset while removing its equal pinned alternative text', async () => {
    const view = tenantView();
    view.runtimeTemplate.branding.logo = {
      url: 'https://example.org/template.svg',
      alternativeText: 'Same',
    };
    view.overrides = {
      branding: { logo: { url: 'https://example.org/own.svg', alternativeText: 'Same' } },
    };
    api.readTenant.mockResolvedValue(view);
    render(<SsfTenantContentV2Page page="appearance" canManage />);
    await screen.findByRole('textbox', { name: 'v2.logoUrl' });
    fireEvent.click(screen.getAllByRole('button', { name: 'fields.inherit' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeTenant).toHaveBeenCalledWith({}, revision));
  });
});
