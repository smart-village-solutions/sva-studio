import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToolsPanelBody } from '../src/waste-management.tools-panel.body.js';

const { importSectionPropsSpy } = vi.hoisted(() => ({
  importSectionPropsSpy: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { readonly text: string } | null }) =>
    message ? <div>{message.text}</div> : null,
}));

vi.mock('../src/waste-management.tools.import-section.js', () => ({
  WasteToolsImportSection: (props: unknown) => {
    importSectionPropsSpy(props);
    return <div>import-section</div>;
  },
}));

vi.mock('../src/waste-management.tools.history.js', () => ({
  WasteToolsHistory: () => <div>history-section</div>,
}));

vi.mock('../src/waste-management.tools-panel.parts.js', () => ({
  WasteToolsInitializeSection: () => <div>initialize-section</div>,
  createImportSelectionHandlers: vi.fn(),
}));

vi.mock('../src/waste-management.tools.actions-section.js', () => ({
  WasteToolsActionsSection: () => <div>actions-section</div>,
}));

describe('WasteToolsPanelBody', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    importSectionPropsSpy.mockReset();
  });

  it('keeps advanced system actions collapsed by default', () => {
    render(
      <WasteToolsPanelBody
        access={{
          canRunImport: true,
          canRunInitialize: true,
          canRunMigrations: true,
          canEnrichPostalCodes: true,
          canRunSeed: true,
          canRunReset: true,
          canDeleteHistoryEntries: false,
        }}
        overview={<div>overview-section</div>}
        runningAction={null}
        message={null}
        lastJob={null}
        technicalHistory={[]}
        runDeleteHistoryEntry={vi.fn(async () => true)}
        importCatalog={[]}
        importProfileId=""
        importSourceFormat="text/csv"
        importBlobRef=""
        importDryRun={false}
        delimiterOverride={undefined}
        previewResult={null}
        previewReady={false}
        importSelectionHandlers={{
          onImportProfileIdChange: vi.fn(),
          onImportSourceFormatChange: vi.fn(),
        }}
        setImportBlobRef={vi.fn()}
        setImportDryRun={vi.fn()}
        setDelimiterOverride={vi.fn()}
        runPreview={vi.fn()}
        runImport={vi.fn()}
        runInitialize={vi.fn()}
        migrationSchema="public"
        migrationVersion=""
        setMigrationSchema={vi.fn()}
        setMigrationVersion={vi.fn()}
        runMigrations={vi.fn()}
        runPostalCodeEnrichment={vi.fn()}
        runSeed={vi.fn()}
        setResetConfirmOpen={vi.fn()}
      />
    );

    expect(screen.getByText('import-section')).toBeTruthy();
    expect(screen.getByText('history-section')).toBeTruthy();
    const advanced = screen.getByText('tools.meta.advancedTitle', { selector: 'summary' });
    const advancedDisclosure = advanced.closest('details');
    expect(advancedDisclosure?.open).toBe(false);
    expect(screen.getByText('actions-section').closest('details')).toBe(advancedDisclosure);
    expect(screen.getByText('overview-section').closest('details')?.open).toBe(false);
    expect(importSectionPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onImportDryRunChange: expect.any(Function),
      })
    );

    fireEvent.click(advanced);
    expect(advancedDisclosure?.open).toBe(true);

    expect(screen.getByText('actions-section')).toBeTruthy();
    expect(screen.getByText('initialize-section')).toBeTruthy();
    fireEvent.click(screen.getByText('tools.meta.technicalDetailsToggle', { selector: 'summary' }));
    expect(screen.getByText('overview-section').closest('details')?.open).toBe(true);
  });
});
