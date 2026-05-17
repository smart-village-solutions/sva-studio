import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToolsImportSection } from '../src/waste-management.tools.import-section.js';
import { readFileAsDataUrl } from '../src/waste-management.page.support.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('../src/waste-management.page.support.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.page.support.js')>(
    '../src/waste-management.page.support.js'
  );

  return {
    ...actual,
    readFileAsDataUrl: vi.fn(async (file: File) => `data:${file.type};base64,ZmFrZQ==`),
  };
});

const importCatalog = [
  {
    profileId: 'waste-management.ortsbezogene-tourtermine',
    displayName: 'Tourzuordnungen nach Fraktionen',
    description: 'Importiert Tourzuordnungen.',
    sourceFormats: ['text/csv'],
    requiredColumns: [{ key: 'Ort', required: true, example: 'Musterstadt' }],
    optionalColumns: [{ key: 'Region', required: false, example: 'Nord' }],
    templateDelimiter: ';',
    templateHeaders: ['Ort', 'Straße', 'Hausmüll', 'Papier'],
    templateSampleRows: [['Musterstadt', 'Hauptstraße', 'HM.3.3', 'PPK.7.2']],
  },
  {
    profileId: 'waste-management.geografie-abholorte',
    displayName: 'Geografie und Abholorte',
    description: 'Importiert Geografie.',
    sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    requiredColumns: [{ key: 'region_id', required: true, example: 'region-1' }],
    optionalColumns: [],
  },
] as const;

const previewResult = {
  detectedDelimiter: ';',
  delimiter: ';',
  fractionNames: ['Hausmüll', 'Papier'],
  existingFractions: ['Papier'],
  validRowCount: 4,
  invalidRowCount: 1,
  newFractions: ['Hausmüll'],
  existingTours: ['PPK.7.2'],
  newTours: ['Restmüll Nord'],
  summary: {
    fractions: { created: 1, existing: 2 },
    regions: { created: 0, existing: 1 },
    cities: { created: 0, existing: 1 },
    streets: { created: 0, existing: 1 },
    houseNumbers: { created: 0, existing: 1 },
    locations: { created: 2, existing: 2 },
    assignments: { created: 2, existing: 0 },
  },
  errors: [{ rowNumber: 3, column: 'Ort', message: 'Pflichtfeld fehlt', value: '' }],
} as const;

const renderImportSection = () => {
  const callbacks = {
    onRunPreview: vi.fn(),
    onStartImport: vi.fn(),
  };

  const Wrapper = () => {
    const [importProfileId, setImportProfileId] = React.useState<
      'waste-management.ortsbezogene-tourtermine' | 'waste-management.geografie-abholorte'
    >('waste-management.ortsbezogene-tourtermine');
    const [importSourceFormat, setImportSourceFormat] = React.useState<'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'>(
      'text/csv'
    );
    const [importBlobRef, setImportBlobRef] = React.useState('');
    const [delimiterOverride, setDelimiterOverride] = React.useState<undefined | ';' | ',' | '\t' | '|'>(
      undefined
    );
    const [previewReady, setPreviewReady] = React.useState(false);

    return (
      <WasteToolsImportSection
        importCatalog={importCatalog}
        importProfileId={importProfileId}
        importSourceFormat={importSourceFormat}
        importBlobRef={importBlobRef}
        importDryRun={false}
        delimiterOverride={delimiterOverride}
        previewResult={previewReady ? previewResult : null}
        previewReady={previewReady}
        running={false}
        onImportProfileIdChange={(value) => setImportProfileId(value as typeof importProfileId)}
        onImportSourceFormatChange={(value) => setImportSourceFormat(value as typeof importSourceFormat)}
        onImportBlobRefChange={setImportBlobRef}
        onImportDryRunChange={() => undefined}
        onDelimiterOverrideChange={setDelimiterOverride}
        onRunPreview={() => {
          callbacks.onRunPreview();
          setPreviewReady(true);
        }}
        onStartImport={callbacks.onStartImport}
      />
    );
  };

  return { ...render(<Wrapper />), callbacks };
};

describe('WasteToolsImportSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guides the tour-date import through a wizard and blocks the final import before preview', async () => {
    const { callbacks } = renderImportSection();

    expect(screen.getAllByText('tools.imports.wizard.steps.profile.title').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'tools.actions.startImport' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'tools.imports.wizard.actions.continue' }));

    const fileInput = document.querySelector('input[type="file"]');
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['csv'], 'termine.csv', { type: 'text/csv' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('tools.imports.wizard.steps.validation.title')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.previewImport' }));

    await waitFor(() => {
      expect(callbacks.onRunPreview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('tools.imports.previewTitle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'tools.actions.startImport' })).toBeTruthy();
  });

  it('handles failed file reads without triggering the preview callback', async () => {
    vi.mocked(readFileAsDataUrl).mockRejectedValueOnce(new Error('read failed'));

    const { callbacks } = renderImportSection();
    fireEvent.click(screen.getByRole('button', { name: 'tools.imports.wizard.actions.continue' }));

    const fileInput = document.querySelector('input[type="file"]');
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['csv'], 'kaputt.csv', { type: 'text/csv' })],
      },
    });

    await waitFor(() => {
      expect(vi.mocked(readFileAsDataUrl)).toHaveBeenCalled();
    });
    expect(callbacks.onRunPreview).not.toHaveBeenCalled();
  });

});
