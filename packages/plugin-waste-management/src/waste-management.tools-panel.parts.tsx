import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import type { WasteManagementImportSourceFormat } from '@sva/plugin-sdk';

import type { StartWasteManagementImportInput } from './waste-management.api.js';
import { ResetConfirmationDialog } from './waste-management.page.support.js';

type Translate = ReturnType<typeof usePluginTranslation>;

export const WasteToolsInitializeSection = ({
  canRunInitialize,
  running,
  onStart,
}: {
  readonly canRunInitialize: boolean;
  readonly running: boolean;
  readonly onStart: () => void;
}) => {
  const pt: Translate = usePluginTranslation('wasteManagement');

  if (!canRunInitialize) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('audit.dataSourceInitialized')}</h3>
      </div>
      <Button type="button" variant="outline" disabled={running} onClick={onStart}>
        {running ? pt('tools.actions.starting') : pt('audit.dataSourceInitialized')}
      </Button>
    </div>
  );
};

export const createImportSelectionHandlers = ({
  importCatalog,
  selectedImportProfile,
  setImportProfileId,
  setImportSourceFormat,
  setImportBlobRef,
  setDelimiterOverride,
}: {
  readonly importCatalog: readonly {
    readonly profileId: string;
    readonly sourceFormats: readonly WasteManagementImportSourceFormat[];
  }[];
  readonly selectedImportProfile:
    | {
        readonly sourceFormats: readonly WasteManagementImportSourceFormat[];
      }
    | null
    | undefined;
  readonly setImportProfileId: (value: StartWasteManagementImportInput['importProfileId']) => void;
  readonly setImportSourceFormat: (value: WasteManagementImportSourceFormat) => void;
  readonly setImportBlobRef: (value: string) => void;
  readonly setDelimiterOverride: (value: StartWasteManagementImportInput['delimiterOverride']) => void;
}) => ({
  onImportProfileIdChange: (nextProfileId: StartWasteManagementImportInput['importProfileId']) => {
    const matchingProfile = importCatalog.find((profile) => profile.profileId === nextProfileId);
    if (matchingProfile) {
      setImportProfileId(matchingProfile.profileId);
      setImportSourceFormat(matchingProfile.sourceFormats[0] ?? 'text/csv');
      setImportBlobRef('');
      setDelimiterOverride(undefined);
    }
  },
  onImportSourceFormatChange: (nextSourceFormat: WasteManagementImportSourceFormat) => {
    if (selectedImportProfile?.sourceFormats.includes(nextSourceFormat)) {
      setImportSourceFormat(nextSourceFormat);
      setImportBlobRef('');
      setDelimiterOverride(undefined);
    }
  },
});

export const WasteToolsResetDialog = ({
  open,
  token,
  running,
  onOpenChange,
  onTokenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly token: string;
  readonly running: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onTokenChange: (token: string) => void;
  readonly onConfirm: () => void;
}) => (
  <ResetConfirmationDialog
    open={open}
    token={token}
    running={running}
    onOpenChange={onOpenChange}
    onTokenChange={onTokenChange}
    onConfirm={onConfirm}
  />
);
