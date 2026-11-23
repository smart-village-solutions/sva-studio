import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

export const WasteToolsAdvancedSection = ({
  canRunInitialize,
  canRunMigrations,
  canEnrichPostalCodes,
  canRunSeed,
  canRunReset,
  initializeSection,
  actionsSection,
  technicalDetails,
}: {
  readonly canRunInitialize: boolean;
  readonly canRunMigrations: boolean;
  readonly canEnrichPostalCodes: boolean;
  readonly canRunSeed: boolean;
  readonly canRunReset: boolean;
  readonly initializeSection: ReactNode;
  readonly actionsSection: ReactNode;
  readonly technicalDetails: ReactNode;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const hasSystemActions =
    canRunInitialize || canRunMigrations || canEnrichPostalCodes || canRunSeed || canRunReset;

  if (!hasSystemActions && !technicalDetails) {
    return null;
  }

  return (
    <details className="rounded-lg border border-border-subtle bg-card p-4">
      <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {pt('tools.meta.advancedTitle')}
      </summary>
      <div className="mt-4 space-y-5">
        <p className="text-sm text-muted-foreground">{pt('tools.meta.advancedDescription')}</p>
        {initializeSection}
        {actionsSection}
        {technicalDetails ? (
          <details className="space-y-3 border-t border-border/70 pt-4">
            <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {pt('tools.meta.technicalDetailsToggle')}
            </summary>
            {technicalDetails}
          </details>
        ) : null}
      </div>
    </details>
  );
};
