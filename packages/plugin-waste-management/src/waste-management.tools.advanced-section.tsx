import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

export const WasteToolsAdvancedSection = ({
  canRunInitialize,
  canRunMigrations,
  canRunSeed,
  canRunReset,
  initializeSection,
  actionsSection,
  technicalDetails,
}: {
  readonly canRunInitialize: boolean;
  readonly canRunMigrations: boolean;
  readonly canRunSeed: boolean;
  readonly canRunReset: boolean;
  readonly runningAction: 'import' | 'migration' | 'seed' | 'reset' | null;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly onMigrationSchemaChange: (value: string) => void;
  readonly onMigrationVersionChange: (value: string) => void;
  readonly onStartInitialize: () => void;
  readonly onStartMigrations: () => void;
  readonly onStartSeed: () => void;
  readonly onOpenReset: () => void;
  readonly initializeSection: ReactNode;
  readonly actionsSection: ReactNode;
  readonly technicalDetails: ReactNode;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [open, setOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const contentId = useId();
  const technicalId = useId();
  const hasSystemActions = canRunInitialize || canRunMigrations || canRunSeed || canRunReset;

  if (!hasSystemActions && !technicalDetails) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('tools.meta.advancedTitle')}</h3>
          <p className="text-sm text-muted-foreground">{pt('tools.meta.advancedDescription')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
        >
          {pt('tools.meta.advancedTitle')}
        </Button>
      </div>
      {open ? (
        <div id={contentId} className="space-y-5">
          {initializeSection}
          {actionsSection}
          {technicalDetails ? (
            <div className="space-y-3 border-t border-border/70 pt-4">
              <Button
                type="button"
                variant="ghost"
                aria-expanded={technicalOpen}
                aria-controls={technicalId}
                onClick={() => setTechnicalOpen((value) => !value)}
              >
                {pt('tools.meta.technicalDetailsToggle')}
              </Button>
              {technicalOpen ? <div id={technicalId}>{technicalDetails}</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
