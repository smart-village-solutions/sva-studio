import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteOutputPanel } from '../src/waste-management.output-panel.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementMasterDataOverview: vi.fn(),
  getWasteManagementOutputOverview: vi.fn(),
  createWasteManagementOutputPdf: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
  formatTechnicalDateTimeInEditorTimeZone: (value: string) => value,
  wasteManagementOperationsContract: {
    resetConfirmationToken: 'RESET',
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
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
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Alert: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioConfirmDialog: ({ children }: { readonly children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.api.js', () => apiMocks);

describe('WasteOutputPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMocks.getWasteManagementMasterDataOverview.mockReset();
    apiMocks.getWasteManagementOutputOverview.mockReset();
    apiMocks.createWasteManagementOutputPdf.mockReset();

    apiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({
      fractions: [],
      regions: [{ id: 'region-1', name: 'Region Nord', createdAt: '', updatedAt: '' }],
      cities: [{ id: 'city-1', regionId: 'region-1', name: 'Musterstadt', createdAt: '', updatedAt: '' }],
      streets: [{ id: 'street-1', cityId: 'city-1', name: 'Hauptstraße', createdAt: '', updatedAt: '' }],
      houseNumbers: [{ id: 'house-1', streetId: 'street-1', number: '12', createdAt: '', updatedAt: '' }],
      collectionLocations: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          regionId: 'region-1',
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      locationTourLinks: [],
    });
    apiMocks.getWasteManagementOutputOverview.mockResolvedValue({
      collectionLocations: [],
    });
    apiMocks.createWasteManagementOutputPdf.mockResolvedValue({
      collectionLocationId: '11111111-1111-4111-8111-111111111111',
      year: 2026,
      storageKey: 'waste-output/collection-locations/11111111-1111-4111-8111-111111111111/2026.pdf',
      deliveryUrl: 'https://cdn.example/location-1/2026.pdf',
      expiresAt: '2026-05-21T12:00:00.000Z',
    });
  });

  it('loads locations, generates a pdf and shows the resulting links', async () => {
    render(<WasteOutputPanel />);

    expect(await screen.findByText('output.pdf.title')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('output.pdf.fields.collectionLocationId'), {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });
    fireEvent.change(screen.getByLabelText('output.pdf.fields.year'), {
      target: { value: '2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'output.pdf.actions.generate' }));

    await waitFor(() => {
      expect(apiMocks.createWasteManagementOutputPdf).toHaveBeenCalledWith({
        collectionLocationId: '11111111-1111-4111-8111-111111111111',
        year: 2026,
      });
    });

    expect(await screen.findByText('output.pdf.messages.generateSuccess')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'output.pdf.actions.open' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('output.pdf.existing.yearLabel:{"value":2026}').length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
