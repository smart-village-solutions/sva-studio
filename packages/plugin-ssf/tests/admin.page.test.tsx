// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  accessSnapshot: {
    isResolved: true,
    assignedModules: ['ssf'],
    permissionActions: ['ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage'],
    roles: [] as string[],
  },
  readSystem: vi.fn(),
  writeSystem: vi.fn(),
  readTenant: vi.fn(),
  writeTenant: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  readSessionAccessSnapshot: () => state.accessSnapshot,
  subscribeSessionAccessSnapshot: () => () => undefined,
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/admin-api.js', () => ({
  readSsfSystemConfiguration: state.readSystem,
  writeSsfSystemConfiguration: state.writeSystem,
  readSsfTenantConfiguration: state.readTenant,
  writeSsfTenantConfiguration: state.writeTenant,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input type="checkbox" {...props} />
  ),
  RichTextHtmlEditor: ({
    id,
    labelId,
    value,
    disabled,
    onChange,
  }: {
    id: string;
    labelId: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
  }) => (
    <textarea
      id={id}
      aria-labelledby={labelId}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
  StudioErrorState: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StudioField: ({
    children,
    id,
    label,
  }: React.PropsWithChildren<{ id: string; label: string }>) => (
    <label htmlFor={id}>
      {label}
      {children}
    </label>
  ),
  StudioFormActionBar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StudioFormSummary: ({ children }: React.PropsWithChildren) => <div role="status">{children}</div>,
  StudioLoadingState: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StudioOverviewPageTemplate: ({ children }: React.PropsWithChildren) => <main>{children}</main>,
  StudioSection: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
  Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsList: ({ children, ...props }: React.PropsWithChildren) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children }: React.PropsWithChildren) => <button type="button">{children}</button>,
}));

const systemConfiguration = {
  defaultLocale: 'de-DE' as const,
  conversationContentStorageMode: 'disabled' as const,
  locales: [
    {
      locale: 'de-DE' as const,
      available: true,
      authenticatedHomeExplanationHtml: '<p>Angemeldet</p>',
      guestExplanationHtml: '<p>Gast</p>',
      conversationContentStorageQuestionHtml: '<p>Speichern?</p>',
    },
    {
      locale: 'en' as const,
      available: true,
      authenticatedHomeExplanationHtml: '<p>Signed in</p>',
      guestExplanationHtml: '<p>Guest</p>',
      conversationContentStorageQuestionHtml: '<p>Store?</p>',
    },
  ],
};

const tenantView = {
  system: systemConfiguration,
  overrides: {
    defaultLocale: null,
    conversationContentStorageMode: null,
    locales: systemConfiguration.locales.map(({ locale }) => ({
      locale,
      enabled: null,
      authenticatedHomeExplanationHtml: null,
      guestExplanationHtml: null,
      conversationContentStorageQuestionHtml: null,
    })),
  },
  effective: systemConfiguration,
};

describe('SSF configuration pages', () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.accessSnapshot.permissionActions = [
      'ssf.configuration.tenant.read',
      'ssf.configuration.tenant.manage',
    ];
    state.readSystem.mockReset().mockResolvedValue(systemConfiguration);
    state.writeSystem.mockReset();
    state.readTenant.mockReset().mockResolvedValue(tenantView);
    state.writeTenant.mockReset();
  });

  it('keeps the system draft visible and reports a failed save', async () => {
    state.writeSystem.mockRejectedValue(new Error('write failed'));
    const { SsfSystemConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfSystemConfigurationPage />);

    await screen.findByDisplayValue('<p>Angemeldet</p>');
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await screen.findByText('status.saveError');
    expect(screen.getByDisplayValue('<p>Angemeldet</p>')).toBeTruthy();
  });

  it('edits, discards and saves system defaults', async () => {
    const savedConfiguration = { ...systemConfiguration, defaultLocale: 'en' as const };
    state.writeSystem.mockResolvedValue(savedConfiguration);
    const { SsfSystemConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfSystemConfigurationPage />);

    const defaultLocale = (await screen.findByLabelText(
      'fields.defaultLocale'
    )) as HTMLSelectElement;
    fireEvent.change(defaultLocale, { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.discard' }));
    expect(defaultLocale.value).toBe('de-DE');

    fireEvent.change(defaultLocale, { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() =>
      expect(state.writeSystem).toHaveBeenCalledWith({
        ...systemConfiguration,
        defaultLocale: 'en',
      })
    );
    expect(await screen.findByText('status.saved')).toBeTruthy();
  });

  it('retries a failed system configuration load', async () => {
    state.readSystem.mockRejectedValueOnce(new Error('read failed'));
    const { SsfSystemConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfSystemConfigurationPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'status.loadError' }));

    expect(await screen.findByDisplayValue('<p>Angemeldet</p>')).toBeTruthy();
    expect(state.readSystem).toHaveBeenCalledTimes(2);
  });

  it('renders inherited tenant values read-only without a manage permission', async () => {
    state.accessSnapshot.permissionActions = ['ssf.configuration.tenant.read'];
    const { SsfTenantConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfTenantConfigurationPage />);

    await screen.findByDisplayValue('<p>Angemeldet</p>');
    expect(screen.queryByRole('button', { name: 'actions.save' })).toBeNull();
    expect((screen.getByLabelText('fields.defaultLocale') as HTMLSelectElement).disabled).toBe(
      true
    );
    expect(state.writeTenant).not.toHaveBeenCalled();
  });

  it('writes tenant overrides and renders the confirmed read-back', async () => {
    state.writeTenant.mockResolvedValue(tenantView);
    const { SsfTenantConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfTenantConfigurationPage />);

    await screen.findByDisplayValue('<p>Angemeldet</p>');
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(state.writeTenant).toHaveBeenCalledWith(tenantView.overrides));
    expect(await screen.findByText('status.saved')).toBeTruthy();
  });

  it('writes edited tenant locale and inheritance controls', async () => {
    state.writeTenant.mockResolvedValue(tenantView);
    const { SsfTenantConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfTenantConfigurationPage />);

    await screen.findByDisplayValue('<p>Angemeldet</p>');
    fireEvent.change(screen.getByLabelText('fields.defaultLocale'), { target: { value: 'en' } });
    fireEvent.change(screen.getByLabelText('fields.storageMode'), { target: { value: 'ask' } });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(checkboxes[2]!);
    fireEvent.change(screen.getAllByRole('textbox')[0]!, {
      target: { value: '<p>Eigener Text</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() =>
      expect(state.writeTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          conversationContentStorageMode: 'ask',
          locales: expect.arrayContaining([
            expect.objectContaining({
              locale: 'de-DE',
              enabled: null,
              authenticatedHomeExplanationHtml: '<p>Eigener Text</p>',
            }),
          ]),
        })
      )
    );
  });

  it('reports tenant load and save failures without losing the draft', async () => {
    state.readTenant.mockRejectedValueOnce(new Error('read failed'));
    state.writeTenant.mockRejectedValue(new Error('write failed'));
    const { SsfTenantConfigurationPage } = await import('../src/admin.page.js');
    render(<SsfTenantConfigurationPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'status.loadError' }));
    await screen.findByDisplayValue('<p>Angemeldet</p>');
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    expect(await screen.findByText('status.saveError')).toBeTruthy();
    expect(screen.getByDisplayValue('<p>Angemeldet</p>')).toBeTruthy();
  });
});
