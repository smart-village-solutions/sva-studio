import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';
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
          <button
            key={profile.profileId}
            type="button"
            aria-pressed={isSelected}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              isSelected
                ? 'border-primary bg-primary/10'
                : isPrimary
                  ? 'border-border/70 bg-muted/10 hover:border-primary/50'
                  : 'border-border/60 bg-background hover:border-border'
            }`}
            onClick={() => onSelect(profile.profileId)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`text-sm font-semibold ${isPrimary ? 'text-base' : ''}`}>
                {profile.displayName}
              </h4>
              {isPrimary ? (
                <Badge variant="secondary">{pt('tools.imports.wizard.preferredBadge')}</Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{profile.description}</p>
          </button>
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
