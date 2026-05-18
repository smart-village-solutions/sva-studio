import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToolsImportSection } from '../src/waste-management.tools.import-section.js';
import { readFileAsDataUrl } from '../src/waste-management.page.support.js';
import {
  createImportFileChangeHandler,
  isPreviewRequiredImportProfile,
  locationTourPickupDateProfileId,
  resolveImportFileAccept,
  resolveSelectedImportProfile,
  WasteToolsWizardStepList,
} from '../src/waste-management.tools.import-section.parts.js';

const { downloadImportTemplateMock, downloadImportPreviewErrorsMock } = vi.hoisted(() => ({
  downloadImportTemplateMock: vi.fn(),
  downloadImportPreviewErrorsMock: vi.fn(),
}));

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
    downloadImportTemplate: downloadImportTemplateMock,
    downloadImportPreviewErrors: downloadImportPreviewErrorsMock,
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
    cleanup();
    vi.restoreAllMocks();
    downloadImportTemplateMock.mockReset();
    downloadImportPreviewErrorsMock.mockReset();
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
      expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
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

  it('walks non-preview profiles through confirmation, supports source-format changes, and resets for a new import after success', async () => {
    const callbacks = {
      onStartImport: vi.fn(),
    };

    const Wrapper = () => {
      const [importProfileId, setImportProfileId] = React.useState<
        'waste-management.ortsbezogene-tourtermine' | 'waste-management.geografie-abholorte'
      >('waste-management.geografie-abholorte');
      const [importSourceFormat, setImportSourceFormat] = React.useState<'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'>(
        'text/csv'
      );
      const [importBlobRef, setImportBlobRef] = React.useState('');
      const [lastJob, setLastJob] = React.useState<{ id: string; status: string } | null>(null);

      return (
        <WasteToolsImportSection
          importCatalog={importCatalog}
          importProfileId={importProfileId}
          importSourceFormat={importSourceFormat}
          importBlobRef={importBlobRef}
          importDryRun={false}
          delimiterOverride={undefined}
          previewResult={null}
          previewReady={false}
          running={false}
          lastJob={lastJob as never}
          onImportProfileIdChange={(value) => setImportProfileId(value as typeof importProfileId)}
          onImportSourceFormatChange={(value) => setImportSourceFormat(value as typeof importSourceFormat)}
          onImportBlobRefChange={setImportBlobRef}
          onImportDryRunChange={() => undefined}
          onDelimiterOverrideChange={() => undefined}
          onRunPreview={async () => null}
          onStartImport={async () => {
            callbacks.onStartImport();
            const job = { id: 'job-77', status: 'queued' };
            setLastJob(job);
            return job as never;
          }}
        />
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'tools.imports.wizard.actions.continue' }));
    fireEvent.change(screen.getByLabelText('tools.imports.sourceFormatLabel'), {
      target: { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    });

    const fileInput = document.querySelector('input[type="file"]');
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['xlsx'], 'orte.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })],
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'tools.imports.wizard.actions.continueToConfirmation' })[0]!);
    expect(screen.getByText('tools.imports.wizard.confirmTitle')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'tools.actions.startImport' })[0]!);

    await waitFor(() => {
      expect(callbacks.onStartImport).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('tools.imports.wizard.resultTitle')).toBeTruthy();
    expect(screen.getByText('job-77')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tools.imports.wizard.actions.startNew' }));
    expect(screen.getAllByText('tools.imports.wizard.steps.profile.title').length).toBeGreaterThan(0);
  });

  it('downloads templates and preview error exports for preview-guided imports', async () => {
    const { callbacks } = renderImportSection();

    fireEvent.click(screen.getByRole('button', { name: 'tools.imports.wizard.actions.continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.downloadTemplate' }));
    expect(downloadImportTemplateMock).toHaveBeenCalledTimes(1);

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
      expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.previewImport' }));

    await waitFor(() => {
      expect(callbacks.onRunPreview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.downloadErrorFile' }));
    expect(downloadImportPreviewErrorsMock).toHaveBeenCalledTimes(1);
  });

  it('returns to validation when the delimiter changes after a successful preview', async () => {
    const { callbacks } = renderImportSection();

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
      expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.previewImport' }));

    await waitFor(() => {
      expect(callbacks.onRunPreview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /tools\.imports\.wizard\.steps\.upload\.title/i }));
    fireEvent.change(screen.getByLabelText('tools.imports.delimiterLabel'), {
      target: { value: ',' },
    });

    expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
    expect(screen.queryByText('tools.imports.previewTitle')).toBeNull();
  });

  it('keeps the wizard on the validation step when preview returns no result', async () => {
    const onRunPreview = vi.fn(async () => null);

    const Wrapper = () => {
      const [importBlobRef, setImportBlobRef] = React.useState('');

      return (
        <WasteToolsImportSection
          importCatalog={importCatalog}
          importProfileId="waste-management.ortsbezogene-tourtermine"
          importSourceFormat="text/csv"
          importBlobRef={importBlobRef}
          importDryRun={false}
          delimiterOverride={undefined}
          previewResult={null}
          previewReady={false}
          running={false}
          lastJob={null}
          onImportProfileIdChange={() => undefined}
          onImportSourceFormatChange={() => undefined}
          onImportBlobRefChange={setImportBlobRef}
          onImportDryRunChange={() => undefined}
          onDelimiterOverrideChange={() => undefined}
          onRunPreview={onRunPreview}
          onStartImport={async () => null}
        />
      );
    };

    render(<Wrapper />);
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
      expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.previewImport' }));

    await waitFor(() => {
      expect(onRunPreview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText('tools.imports.wizard.steps.validation.title').length).toBeGreaterThan(0);
    expect(screen.queryByText('tools.imports.previewTitle')).toBeNull();
  });

  it('covers import helper branches and wizard navigation reachability', async () => {
    expect(resolveSelectedImportProfile(importCatalog, 'missing-profile')?.profileId).toBe(
      locationTourPickupDateProfileId
    );
    expect(resolveSelectedImportProfile([], 'missing-profile')).toBeNull();
    expect(resolveImportFileAccept('text/csv')).toBe('.csv,text/csv');
    expect(resolveImportFileAccept('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(isPreviewRequiredImportProfile(importCatalog[0])).toBe(true);
    expect(isPreviewRequiredImportProfile(importCatalog[1])).toBe(false);
    expect(isPreviewRequiredImportProfile(null)).toBe(false);

    const onImportBlobRefChange = vi.fn();
    const onAfterChange = vi.fn();
    const handler = createImportFileChangeHandler({
      onImportBlobRefChange,
      readFileAsDataUrl: vi.fn(async () => 'data:text/csv;base64,ZmFrZQ=='),
      onAfterChange,
    });

    handler({
      target: {
        files: [new File(['csv'], 'termine.csv', { type: 'text/csv' })],
      },
    } as React.ChangeEvent<HTMLInputElement>);

    await waitFor(() => {
      expect(onImportBlobRefChange).toHaveBeenCalledWith('data:text/csv;base64,ZmFrZQ==');
    });
    expect(onAfterChange).toHaveBeenCalledTimes(1);

    const noFileHandler = createImportFileChangeHandler({
      onImportBlobRefChange,
      readFileAsDataUrl: vi.fn(async () => 'ignored'),
      onAfterChange,
    });
    noFileHandler({ target: { files: [] } } as React.ChangeEvent<HTMLInputElement>);
    expect(onImportBlobRefChange).toHaveBeenCalledWith('');

    const onStepChange = vi.fn();
    render(
      <WasteToolsWizardStepList activeStep="upload" reachableStep="validation" onStepChange={onStepChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: /tools\.imports\.wizard\.steps\.profile\.title/i }));
    expect(onStepChange).toHaveBeenCalledWith('profile');
    expect(screen.getByRole('button', { name: /tools\.imports\.wizard\.steps\.preview\.title/i })).toHaveProperty(
      'disabled',
      true
    );
  });

});
