import { usePluginTranslation } from '@sva/plugin-sdk';
import { badgeVariants, Button } from '@sva/studio-ui-react';
import {
  locationTourPickupDateProfileId,
  WasteToolsWizardFooter,
  type ImportCatalogEntry,
} from './waste-management.tools.import-section.parts.support.js';

const WasteToolsImportProfileChooser = ({
  importCatalog,
  selectedProfileId,
  onSelect,
}: {
  readonly importCatalog: readonly ImportCatalogEntry[];
  readonly selectedProfileId: string;
  readonly onSelect: (profileId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const orderedProfiles = [...importCatalog].sort((left, right) => {
    if (left.profileId === locationTourPickupDateProfileId) {
      return -1;
    }
    if (right.profileId === locationTourPickupDateProfileId) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName, 'de');
  });

  return (
    <div className="space-y-3">
      {orderedProfiles.map((profile) => {
        const isPrimary = profile.profileId === locationTourPickupDateProfileId;
        const isSelected = profile.profileId === selectedProfileId;
        return (
          <Button
            variant="secondary"
            key={profile.profileId}
            type="button"
            aria-pressed={isSelected}
            className={`h-auto w-full flex-col items-stretch whitespace-normal rounded-lg border p-4 text-left transition ${
              isSelected
                ? 'border-primary bg-primary/10'
                : isPrimary
                  ? 'border-border/70 bg-surface-inset hover:border-primary/50'
                  : 'border-border-subtle bg-background hover:border-border'
            }`}
            onClick={() => onSelect(profile.profileId)}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-semibold ${isPrimary ? 'text-base' : ''}`}>
                {profile.displayName}
              </span>
              {isPrimary ? (
                <span className={badgeVariants({ variant: 'secondary' })}>
                  {pt('tools.imports.wizard.preferredBadge')}
                </span>
              ) : null}
            </span>
            <span className="mt-2 block text-sm text-muted-foreground">{profile.description}</span>
          </Button>
        );
      })}
    </div>
  );
};
export const WasteToolsProfileStep = ({
  importCatalog,
  selectedProfileId,
  onSelect,
  onContinue,
}: {
  readonly importCatalog: readonly ImportCatalogEntry[];
  readonly selectedProfileId: string;
  readonly onSelect: (profileId: string) => void;
  readonly onContinue: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-5">
      <WasteToolsImportProfileChooser
        importCatalog={importCatalog}
        selectedProfileId={selectedProfileId}
        onSelect={onSelect}
      />
      <WasteToolsWizardFooter
        primaryAction={
          <Button type="button" onClick={onContinue}>
            {pt('tools.imports.wizard.actions.continue')}
          </Button>
        }
      />
    </div>
  );
};
