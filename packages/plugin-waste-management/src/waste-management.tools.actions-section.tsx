import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

export const WasteToolsActionsSection = ({
  canRunMigrations,
  canRunSeed,
  canRunReset,
  migrationSchema,
  migrationVersion,
  runningAction,
  onMigrationSchemaChange,
  onMigrationVersionChange,
  onStartMigrations,
  onStartSeed,
  onOpenReset,
}: {
  readonly canRunMigrations: boolean;
  readonly canRunSeed: boolean;
  readonly canRunReset: boolean;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly runningAction: 'import' | 'migration' | 'seed' | 'reset' | null;
  readonly onMigrationSchemaChange: (value: string) => void;
  readonly onMigrationVersionChange: (value: string) => void;
  readonly onStartMigrations: () => void;
  readonly onStartSeed: () => void;
  readonly onOpenReset: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      {canRunMigrations ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.migrations.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.migrations.description')}</p>
          </div>
          <StudioFieldGroup>
            <StudioField id="waste-tools-migration-schema" label={pt('tools.migrations.schemaLabel')}>
              <Input
                id="waste-tools-migration-schema"
                value={migrationSchema}
                onChange={(event) => onMigrationSchemaChange(event.target.value)}
              />
            </StudioField>
            <StudioField id="waste-tools-migration-version" label={pt('tools.migrations.versionLabel')}>
              <Input
                id="waste-tools-migration-version"
                value={migrationVersion}
                onChange={(event) => onMigrationVersionChange(event.target.value)}
              />
            </StudioField>
          </StudioFieldGroup>
          <Button type="button" disabled={runningAction !== null} onClick={onStartMigrations}>
            {runningAction === 'migration' ? pt('tools.actions.starting') : pt('tools.actions.startMigrations')}
          </Button>
        </div>
      ) : null}

      {canRunSeed ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.seed.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.seed.description')}</p>
          </div>
          <Button type="button" disabled={runningAction !== null} onClick={onStartSeed}>
            {runningAction === 'seed' ? pt('tools.actions.starting') : pt('tools.actions.startSeed')}
          </Button>
        </div>
      ) : null}

      {canRunReset ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.reset.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.reset.description')}</p>
          </div>
          <Button type="button" variant="destructive" disabled={runningAction !== null} onClick={onOpenReset}>
            {runningAction === 'reset' ? pt('tools.actions.starting') : pt('tools.actions.startReset')}
          </Button>
        </div>
      ) : null}
    </>
  );
};
