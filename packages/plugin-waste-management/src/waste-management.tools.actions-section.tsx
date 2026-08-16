import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

type WasteToolsActionsSectionProps = {
  readonly canRunMigrations: boolean;
  readonly canEnrichPostalCodes: boolean;
  readonly canRunSeed: boolean;
  readonly canRunReset: boolean;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly runningAction: 'export' | 'import' | 'migration' | 'postalCode' | 'seed' | 'reset' | null;
  readonly postalCodeJobActive?: boolean;
  readonly onMigrationSchemaChange: (value: string) => void;
  readonly onMigrationVersionChange: (value: string) => void;
  readonly onStartMigrations: () => void;
  readonly onStartPostalCodeEnrichment: () => void;
  readonly onStartSeed: () => void;
  readonly onOpenReset: () => void;
};

const WasteToolAction = ({
  title,
  description,
  actionLabel,
  running,
  disabled,
  destructive = false,
  onClick,
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly running: boolean;
  readonly disabled: boolean;
  readonly destructive?: boolean;
  readonly onClick: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        variant={destructive ? 'destructive' : 'primary'}
        disabled={disabled}
        onClick={onClick}
      >
        {running ? pt('tools.actions.starting') : actionLabel}
      </Button>
    </div>
  );
};

const WasteMigrationsAction = ({
  schema,
  version,
  running,
  disabled,
  onSchemaChange,
  onVersionChange,
  onStart,
}: {
  readonly schema: string;
  readonly version: string;
  readonly running: boolean;
  readonly disabled: boolean;
  readonly onSchemaChange: (value: string) => void;
  readonly onVersionChange: (value: string) => void;
  readonly onStart: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('tools.migrations.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('tools.migrations.description')}</p>
      </div>
      <StudioFieldGroup>
        <StudioField id="waste-tools-migration-schema" label={pt('tools.migrations.schemaLabel')}>
          <Input
            id="waste-tools-migration-schema"
            value={schema}
            onChange={(event) => onSchemaChange(event.target.value)}
          />
        </StudioField>
        <StudioField id="waste-tools-migration-version" label={pt('tools.migrations.versionLabel')}>
          <Input
            id="waste-tools-migration-version"
            value={version}
            onChange={(event) => onVersionChange(event.target.value)}
          />
        </StudioField>
      </StudioFieldGroup>
      <Button type="button" disabled={disabled} onClick={onStart}>
        {running ? pt('tools.actions.starting') : pt('tools.actions.startMigrations')}
      </Button>
    </div>
  );
};

export const WasteToolsActionsSection = ({
  canRunMigrations,
  canEnrichPostalCodes,
  canRunSeed,
  canRunReset,
  migrationSchema,
  migrationVersion,
  runningAction,
  postalCodeJobActive = false,
  onMigrationSchemaChange,
  onMigrationVersionChange,
  onStartMigrations,
  onStartPostalCodeEnrichment,
  onStartSeed,
  onOpenReset,
}: WasteToolsActionsSectionProps) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      {canRunMigrations ? (
        <WasteMigrationsAction
          schema={migrationSchema}
          version={migrationVersion}
          running={runningAction === 'migration'}
          disabled={runningAction !== null}
          onSchemaChange={onMigrationSchemaChange}
          onVersionChange={onMigrationVersionChange}
          onStart={onStartMigrations}
        />
      ) : null}

      {canRunSeed ? (
        <WasteToolAction
          title={pt('tools.seed.title')}
          description={pt('tools.seed.description')}
          actionLabel={pt('tools.actions.startSeed')}
          running={runningAction === 'seed'}
          disabled={runningAction !== null}
          onClick={onStartSeed}
        />
      ) : null}

      {canEnrichPostalCodes ? (
        <WasteToolAction
          title={pt('tools.postalCodes.title')}
          description={pt('tools.postalCodes.description')}
          actionLabel={pt('tools.actions.startPostalCodeEnrichment')}
          running={runningAction === 'postalCode'}
          disabled={runningAction !== null || postalCodeJobActive}
          onClick={onStartPostalCodeEnrichment}
        />
      ) : null}

      {canRunReset ? (
        <WasteToolAction
          title={pt('tools.reset.title')}
          description={pt('tools.reset.description')}
          actionLabel={pt('tools.actions.startReset')}
          running={runningAction === 'reset'}
          disabled={runningAction !== null}
          destructive
          onClick={onOpenReset}
        />
      ) : null}
    </>
  );
};
