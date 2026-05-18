import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

import { WasteToolsImportProfileCard } from '../src/waste-management.tools.import-profile-card.js';

const downloadImportTemplateMock = vi.hoisted(() => vi.fn());
const downloadImportPreviewErrorsMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  downloadImportTemplate: downloadImportTemplateMock,
  downloadImportPreviewErrors: downloadImportPreviewErrorsMock,
}));

const previewProfile = {
  profileId: 'waste-management.ortsbezogene-tourtermine',
  displayName: 'Tourzuordnungen',
  description: 'Importiert ortsbezogene Tourtermine.',
  sourceFormats: ['text/csv'],
  requiredColumns: [{ key: 'Ort', required: true, example: 'Musterstadt' }],
  optionalColumns: [{ key: 'Region', required: false, example: 'Nord' }],
} as const;

const regularProfile = {
  profileId: 'waste-management.geografie-abholorte',
  displayName: 'Geografie',
  description: 'Importiert Geografie.',
  sourceFormats: ['text/csv'],
  requiredColumns: [{ key: 'region_id', required: true, example: 'region-1' }],
  optionalColumns: [{ key: 'street_id', required: false, example: 'street-1' }],
} as const;

describe('WasteToolsImportProfileCard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing without a selected profile', () => {
    const { container } = render(
      <WasteToolsImportProfileCard
        profile={null}
        sourceFormat="text/csv"
        running={false}
        importBlobRef=""
        previewResult={null}
        previewReady={false}
        fileInputId="file-input"
        onRunPreview={() => undefined}
        onStartImport={() => undefined}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a preview-guided profile, triggers helper actions, and enables import after preview', () => {
    const clickSpy = vi.fn();
    const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue({
      click: clickSpy,
    } as unknown as HTMLElement);
    const onRunPreview = vi.fn();
    const onStartImport = vi.fn();

    render(
      <WasteToolsImportProfileCard
        profile={previewProfile}
        sourceFormat="text/csv"
        running={false}
        importBlobRef="data:text/csv;base64,ZmFrZQ=="
        previewResult={{
          detectedDelimiter: '\t',
          delimiter: ';',
          validRowCount: 3,
          invalidRowCount: 1,
          newTours: ['Tour A'],
          summary: {
            locations: { created: 2, existing: 0 },
            assignments: { created: 4, existing: 0 },
          },
          errors: [{ rowNumber: 2, column: 'Ort', message: 'Pflichtfeld fehlt', value: '' }],
        } as never}
        previewReady
        fileInputId="file-input"
        onRunPreview={onRunPreview}
        onStartImport={onStartImport}
      />
    );

    expect(screen.getByText('tools.imports.previewHintStreet')).toBeTruthy();
    expect(screen.getByText('tools.imports.previewHintHouseNumbers')).toBeTruthy();
    expect(screen.getByText('tools.imports.previewHintDates')).toBeTruthy();
    expect(screen.getByText('Ort')).toBeTruthy();
    expect(screen.getByText('Region')).toBeTruthy();
    expect(screen.getByText('tools.imports.previewTitle')).toBeTruthy();
    expect(
      screen.getByText(
        'tools.imports.previewSummary:{"validRows":3,"invalidRows":1,"createdTours":1,"createdLocations":2,"createdAssignments":4}'
      )
    ).toBeTruthy();
    expect(
      screen.getByText('tools.imports.previewDelimiter:{"detected":"Tab","active":";"}')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.downloadTemplate' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.imports.blobRefLabel' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.previewImport' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.downloadErrorFile' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.startImport' }));

    expect(downloadImportTemplateMock).toHaveBeenCalledWith(previewProfile, 'text/csv');
    expect(getElementByIdSpy).toHaveBeenCalledWith('file-input');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(onRunPreview).toHaveBeenCalledTimes(1);
    expect(downloadImportPreviewErrorsMock).toHaveBeenCalledTimes(1);
    expect(onStartImport).toHaveBeenCalledTimes(1);
  });

  it('keeps preview-only controls hidden or disabled for non-preview profiles and invalid blobs', () => {
    const onStartImport = vi.fn();

    render(
      <WasteToolsImportProfileCard
        profile={regularProfile}
        sourceFormat="text/csv"
        running={true}
        importBlobRef="blob:import"
        previewResult={null}
        previewReady={false}
        fileInputId="file-input"
        onRunPreview={() => undefined}
        onStartImport={onStartImport}
      />
    );

    expect(screen.queryByText('tools.imports.previewHintStreet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'tools.actions.previewImport' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'tools.actions.downloadErrorFile' })).toBeNull();
    expect(screen.getByRole('button', { name: 'tools.actions.starting' }).hasAttribute('disabled')).toBe(true);
  });
});
