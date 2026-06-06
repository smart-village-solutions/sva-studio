import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteOutputPanel } from '../src/waste-management.output-panel.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementSettings: vi.fn(),
  updateWasteManagementSettings: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Textarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: string;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {children}
    </label>
  ),
  Alert: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.api.js')>('../src/waste-management.api.js');
  return {
    ...actual,
    ...apiMocks,
  };
});

describe('WasteOutputPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMocks.getWasteManagementSettings.mockReset();
    apiMocks.updateWasteManagementSettings.mockReset();

    apiMocks.getWasteManagementSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      provider: 'supabase',
      projectUrl: 'https://tenant.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    });
    apiMocks.updateWasteManagementSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      provider: 'supabase',
      projectUrl: 'https://tenant.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      pdfBrandingAssetUrl: 'https://cdn.example/logo-next.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 9999',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    });
  });

  it('loads and persists static pdf configuration instead of generating a pdf', async () => {
    render(<WasteOutputPanel />);

    expect(await screen.findByText('output.pdf.title')).toBeTruthy();
    expect(screen.queryByText('output.pdf.fields.collectionLocationId')).toBeNull();

    fireEvent.change(screen.getByLabelText('output.pdf.fields.brandingAssetUrl'), {
      target: { value: 'https://cdn.example/logo-next.svg' },
    });
    fireEvent.change(screen.getByLabelText('output.pdf.fields.contactBlock'), {
      target: { value: 'Abfallberatung 03395 / 9999' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'output.pdf.actions.save' }));

    await waitFor(() => {
      expect(apiMocks.updateWasteManagementSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfBrandingAssetUrl: 'https://cdn.example/logo-next.svg',
          pdfContactBlock: 'Abfallberatung 03395 / 9999',
        })
      );
    });

    expect(await screen.findByText('output.pdf.messages.saveSuccess')).toBeTruthy();
  });
});
