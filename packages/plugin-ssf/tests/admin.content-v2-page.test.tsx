// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  readSystem: vi.fn(), writeSystem: vi.fn(), readTenant: vi.fn(), writeTenant: vi.fn(),
}));
const supportedLanguages = {
  languages: { de: { name: 'German', native: 'Deutsch' }, en: { name: 'English', native: 'English' }, ar: { name: 'Arabic', native: 'العربية' } },
  admin_default: 'de', popular: ['en', 'ar'],
};

vi.mock('@sva/plugin-sdk', () => ({ usePluginTranslation: () => (key: string) => key }));
vi.mock('../src/admin-api.js', () => ({
  readSsfSystemContentV2: api.readSystem,
  writeSsfSystemContentV2: api.writeSystem,
  readSsfTenantContentV2: api.readTenant,
  writeSsfTenantContentV2: api.writeTenant,
}));
vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input type="checkbox" {...props} />,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  RichTextHtmlEditor: ({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) =>
    <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />,
  StudioErrorState: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StudioField: ({ id, label, children }: React.PropsWithChildren<{ id: string; label: string }>) =>
    <label htmlFor={id}>{label}{children}</label>,
  StudioFormActionBar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StudioFormSummary: ({ children }: React.PropsWithChildren) => <div role="status">{children}</div>,
  StudioLoadingState: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StudioSection: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
  Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsTrigger: ({ children }: React.PropsWithChildren) => <button type="button">{children}</button>,
}));

const example = (name: string): Record<string, unknown> => JSON.parse(readFileSync(
  resolve(process.cwd(), '../../docs/api', name), 'utf8'
)) as Record<string, unknown>;
const fields = (name: string) => {
  const value = example(name);
  delete value['contractVersion'];
  delete value['configurationRevision'];
  delete value['tenant'];
  return value;
};

describe('SSF V2 content administration', () => {
  afterEach(cleanup);
  beforeEach(() => {
    api.readSystem.mockReset(); api.writeSystem.mockReset();
    api.readTenant.mockReset(); api.writeTenant.mockReset();
  });

  it('saves installation content independently of the tenant template', async () => {
    const installation = fields('ssf-installation-content-v2.example.json');
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readSystem.mockResolvedValue({ installation, runtimeTemplate });
    api.writeSystem.mockResolvedValue({ installation, runtimeTemplate });
    const { SsfSystemContentV2Page } = await import('../src/admin.content-v2-page.js');
    render(<SsfSystemContentV2Page />);

    const firstSave = (await screen.findAllByRole('button', { name: 'actions.save' }))[0];
    if (!firstSave) throw new Error('installation_save_button_missing');
    fireEvent.click(firstSave);
    await waitFor(() => expect(api.writeSystem).toHaveBeenCalledWith({
      installation, runtimeTemplate: null,
    }));
  });

  it('offers only catalog languages and prefills names when adding one', async () => {
    const installation = fields('ssf-installation-content-v2.example.json');
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    runtimeTemplate['guestLanguages'] = [];
    api.readSystem.mockResolvedValue({ installation, runtimeTemplate, supportedLanguages });
    api.writeSystem.mockResolvedValue({ installation, runtimeTemplate, supportedLanguages });
    const { SsfSystemContentV2Page } = await import('../src/admin.content-v2-page.js');
    render(<SsfSystemContentV2Page />);

    await screen.findByLabelText('v2.newLanguage');
    const staffLocale = document.getElementById('ssf-v2-staff-locale');
    if (!staffLocale) throw new Error('ssf_v2_staff_locale_missing');
    expect(staffLocale.tagName).toBe('SELECT');
    expect(document.getElementById('ssf-v2-localization-locale')?.tagName).toBe('SELECT');
    const languageSelect = screen.getByLabelText('v2.newLanguage');
    expect(Array.from((languageSelect as HTMLSelectElement).options).some((option) => option.value === 'de')).toBe(false);
    fireEvent.change(languageSelect, { target: { value: 'ar' } });
    fireEvent.click(screen.getByRole('button', { name: 'v2.addLanguage' }));
    expect(await screen.findByDisplayValue('العربية')).toBeTruthy();
    expect(screen.getByDisplayValue('Arabic')).toBeTruthy();
  });

  it('excludes staff languages whose primary tag is already used by a guest language', async () => {
    const installation = fields('ssf-installation-content-v2.example.json');
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readSystem.mockResolvedValue({ installation, runtimeTemplate, supportedLanguages });
    const { SsfSystemContentV2Page } = await import('../src/admin.content-v2-page.js');
    render(<SsfSystemContentV2Page />);

    const staffLocale = await screen.findByLabelText('v2.locale', { selector: '#ssf-v2-staff-locale' }) as HTMLSelectElement;
    expect(Array.from(staffLocale.options).some((option) => option.value === 'en')).toBe(false);
  });

  it('keeps text editing available and disables language changes without the catalog', async () => {
    const installation = fields('ssf-installation-content-v2.example.json');
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readSystem.mockResolvedValue({ installation, runtimeTemplate, supportedLanguages: null });
    api.writeSystem.mockResolvedValue({ installation, runtimeTemplate, supportedLanguages: null });
    const { SsfSystemContentV2Page } = await import('../src/admin.content-v2-page.js');
    render(<SsfSystemContentV2Page />);

    await screen.findAllByLabelText('v2.locale');
    expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('v2.languageCatalogUnavailable'))).toBe(true);
    expect((document.getElementById('ssf-v2-staff-locale') as HTMLSelectElement | null)?.disabled).toBe(true);
    expect((document.getElementById('ssf-v2-localization-locale') as HTMLSelectElement | null)?.disabled).toBe(true);
    expect((screen.getByLabelText('v2.newLanguage') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'v2.removeLanguage' })
      .every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByLabelText('v2.dashboardHeadline') as HTMLInputElement).disabled).toBe(false);
  });

  it('clears an optional feedback length without sending null', async () => {
    const installation = fields('ssf-installation-content-v2.example.json');
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readSystem.mockResolvedValue({ installation, runtimeTemplate });
    api.writeSystem.mockImplementation(async (value) => value);
    const { SsfSystemContentV2Page } = await import('../src/admin.content-v2-page.js');
    render(<SsfSystemContentV2Page />);

    await screen.findAllByLabelText('v2.maxLength');
    const length = document.getElementById('ssf-v2-staff-feedback-questions-4-maxLength');
    if (!length) throw new Error('max_length_field_missing');
    fireEvent.change(length, { target: { value: '' } });
    const save = screen.getAllByRole('button', { name: 'actions.save' })[1];
    if (!save) throw new Error('runtime_save_button_missing');
    fireEvent.click(save);

    await waitFor(() => expect(api.writeSystem).toHaveBeenCalledOnce());
    const written = api.writeSystem.mock.calls[0]?.[0] as { runtimeTemplate: {
      staff: { feedback: { questions: { maxLength?: number }[] } };
    } };
    expect(written.runtimeTemplate.staff.feedback.questions[4]?.maxLength).toBeUndefined();
  });

  it('writes only a tenant field override and keeps an unknown feedback question', async () => {
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    const staff = runtimeTemplate['staff'] as { feedback: { questions: unknown[] } };
    staff.feedback.questions.push({ id: 'futureQuestion', type: 'longText', question: 'Another question?' });
    api.readTenant.mockResolvedValue({ runtimeTemplate, overrides: null, supportedLanguages });
    api.writeTenant.mockImplementation(async (overrides) => ({ runtimeTemplate, overrides }));
    const { SsfTenantContentV2Page } = await import('../src/admin.content-v2-tenant-page.js');
    render(<SsfTenantContentV2Page canManage />);

    const heading = await screen.findByLabelText('v2.dashboardHeadline');
    fireEvent.change(heading, { target: { value: 'Tenant heading' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeTenant).toHaveBeenCalledWith({
      staff: { dashboard: { headline: 'Tenant heading' } },
    }));
    expect(staff.feedback.questions).toHaveLength(6);
  });

  it('restores inherited storage settings when a tenant re-enables storage', async () => {
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readTenant.mockResolvedValue({
      runtimeTemplate,
      overrides: { conversationContentStorage: { mode: 'disabled' } },
      supportedLanguages,
    });
    api.writeTenant.mockImplementation(async (overrides) => ({ runtimeTemplate, overrides }));
    const { SsfTenantContentV2Page } = await import('../src/admin.content-v2-tenant-page.js');
    render(<SsfTenantContentV2Page canManage />);

    const mode = await screen.findByLabelText('fields.storageMode');
    fireEvent.change(mode, { target: { value: 'ask' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeTenant).toHaveBeenCalledWith({}));
  });

  it('removes a guest icon override when the inherited icon is absent', async () => {
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    const languages = runtimeTemplate['guestLanguages'] as { locale: string; icon?: unknown }[];
    const first = languages[0];
    if (!first) throw new Error('ssf_v2_test_language_missing');
    delete first.icon;
    api.readTenant.mockResolvedValue({
      runtimeTemplate,
      overrides: { guestLanguages: [{ locale: first.locale, icon: {
        url: 'https://example.org/tenant.svg', alternativeText: 'Tenant icon',
      } }] },
      supportedLanguages,
    });
    api.writeTenant.mockImplementation(async (overrides) => ({ runtimeTemplate, overrides }));
    const { SsfTenantContentV2Page } = await import('../src/admin.content-v2-tenant-page.js');
    render(<SsfTenantContentV2Page canManage />);

    await screen.findAllByLabelText('v2.iconUrl');
    const input = document.getElementById('ssf-v2-guest-0-icon-url');
    if (!input) throw new Error('ssf_v2_icon_input_missing');
    const inherit = input.closest('label')?.nextElementSibling?.nextElementSibling?.querySelector('button');
    if (!inherit) throw new Error('ssf_v2_icon_inherit_button_missing');
    fireEvent.click(inherit);
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(api.writeTenant).toHaveBeenCalledWith({}));
  });

  it('keeps an unsaved guest translation when its language is toggled off and on', async () => {
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readTenant.mockResolvedValue({ runtimeTemplate, overrides: null, supportedLanguages });
    api.writeTenant.mockImplementation(async (overrides) => ({ runtimeTemplate, overrides }));
    const { SsfTenantContentV2Page } = await import('../src/admin.content-v2-tenant-page.js');
    render(<SsfTenantContentV2Page canManage />);

    await screen.findByLabelText('English (en)');
    const explanation = document.getElementById('ssf-v2-guestLanguages-0-guest-explanationHtml');
    if (!explanation) throw new Error('ssf_v2_guest_explanation_missing');
    fireEvent.change(explanation, { target: { value: '<p>Custom guest text</p>' } });
    const toggle = screen.getByLabelText('English (en)');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(api.writeTenant).toHaveBeenCalledWith({
      guestLanguages: [{ locale: 'en', guest: { explanationHtml: '<p>Custom guest text</p>' } }],
    }));
  });

  it('disables tenant guest-language changes when the catalog is unavailable', async () => {
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readTenant.mockResolvedValue({ runtimeTemplate, overrides: null, supportedLanguages: null });
    const { SsfTenantContentV2Page } = await import('../src/admin.content-v2-tenant-page.js');
    render(<SsfTenantContentV2Page canManage />);

    expect((await screen.findByLabelText('English (en)') as HTMLInputElement).disabled).toBe(true);
  });

  it('discards a hidden unsaved guest translation', async () => {
    const runtimeTemplate = fields('ssf-runtime-configuration-v2.example.json');
    api.readTenant.mockResolvedValue({
      runtimeTemplate,
      overrides: { guestLanguages: [{ locale: 'en', enabled: false }] },
      supportedLanguages,
    });
    api.writeTenant.mockImplementation(async (overrides) => ({ runtimeTemplate, overrides }));
    const { SsfTenantContentV2Page } = await import('../src/admin.content-v2-tenant-page.js');
    render(<SsfTenantContentV2Page canManage />);

    fireEvent.click(await screen.findByLabelText('English (en)'));
    const explanation = document.getElementById('ssf-v2-guestLanguages-0-guest-explanationHtml');
    if (!explanation) throw new Error('ssf_v2_guest_explanation_missing');
    fireEvent.change(explanation, { target: { value: '<p>Unsaved text</p>' } });
    fireEvent.click(screen.getByLabelText('English (en)'));
    fireEvent.click(screen.getByRole('button', { name: 'actions.discard' }));
    fireEvent.click(screen.getByLabelText('English (en)'));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(api.writeTenant).toHaveBeenCalledWith({}));
  });
});
