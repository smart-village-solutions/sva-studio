import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WasteToolsActionsSection } from '../src/waste-management.tools.actions-section.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof WasteToolsActionsSection>> = {}
) => {
  const onStartPostalCodeEnrichment = vi.fn();
  render(
    <WasteToolsActionsSection
      canRunMigrations={false}
      canEnrichPostalCodes
      canRunSeed={false}
      canRunReset={false}
      migrationSchema="public"
      migrationVersion=""
      runningAction={null}
      onMigrationSchemaChange={vi.fn()}
      onMigrationVersionChange={vi.fn()}
      onStartMigrations={vi.fn()}
      onStartPostalCodeEnrichment={onStartPostalCodeEnrichment}
      onStartSeed={vi.fn()}
      onOpenReset={vi.fn()}
      {...overrides}
    />
  );
  return { onStartPostalCodeEnrichment };
};

describe('WasteToolsActionsSection', () => {
  it('starts postal-code enrichment and exposes its running state', () => {
    const { onStartPostalCodeEnrichment } = renderSection();
    fireEvent.click(
      screen.getByRole('button', { name: 'tools.actions.startPostalCodeEnrichment' })
    );
    expect(onStartPostalCodeEnrichment).toHaveBeenCalledOnce();

    const { container } = render(
      <WasteToolsActionsSection
        canRunMigrations={false}
        canEnrichPostalCodes
        canRunSeed={false}
        canRunReset={false}
        migrationSchema="public"
        migrationVersion=""
        runningAction="postalCode"
        onMigrationSchemaChange={vi.fn()}
        onMigrationVersionChange={vi.fn()}
        onStartMigrations={vi.fn()}
        onStartPostalCodeEnrichment={vi.fn()}
        onStartSeed={vi.fn()}
        onOpenReset={vi.fn()}
      />
    );
    expect(
      container.querySelector('button[disabled]')?.textContent
    ).toContain('tools.actions.starting');
  });

  it('blocks another postal-code start while its tracked job is active', () => {
    const { container } = render(
      <WasteToolsActionsSection
        canRunMigrations={false}
        canEnrichPostalCodes
        canRunSeed={false}
        canRunReset={false}
        migrationSchema="public"
        migrationVersion=""
        runningAction={null}
        postalCodeJobActive
        onMigrationSchemaChange={vi.fn()}
        onMigrationVersionChange={vi.fn()}
        onStartMigrations={vi.fn()}
        onStartPostalCodeEnrichment={vi.fn()}
        onStartSeed={vi.fn()}
        onOpenReset={vi.fn()}
      />
    );

    expect(container.querySelector('button[disabled]')).not.toBeNull();
  });
});
