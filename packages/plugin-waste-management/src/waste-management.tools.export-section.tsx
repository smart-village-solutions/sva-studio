import type { StudioJobResponse, WasteManagementDataProfileId } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementDataProfiles } from '@sva/plugin-sdk';
import { useState } from 'react';
import { Button, Checkbox, Select } from '@sva/studio-ui-react';

import type { StartWasteManagementExportInput } from './waste-management.api.js';

const profileTranslationKeys: Readonly<Record<WasteManagementDataProfileId, string>> = {
  'waste-management.fraktionen': 'fractions',
  'waste-management.geografie-abholorte': 'geographyCollectionLocations',
  'waste-management.abstandspresets': 'recurrencePresets',
  'waste-management.touren': 'tours',
  'waste-management.abholort-tour-zuordnungen': 'locationTourLinks',
  'waste-management.tour-einsaetze': 'tourAssignments',
  'waste-management.ausweichtermine': 'dateShifts',
  'waste-management.feiertagsregeln': 'holidayRules',
  'waste-management.portable-einstellungen': 'portableSettings',
};

const WasteExportProfileSelector = ({
  profileIds,
  onToggle,
}: {
  readonly profileIds: readonly WasteManagementDataProfileId[];
  readonly onToggle: (profileId: WasteManagementDataProfileId, checked: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{pt('tools.exports.profilesLabel')}</legend>
      <div className="grid gap-2 md:grid-cols-2">
        {wasteManagementDataProfiles.map((profile) => {
          const id = `waste-export-${profile.profileId}`;
          return (
            <label key={profile.profileId} htmlFor={id} className="flex items-start gap-2 rounded-lg border border-border/60 p-3">
              <Checkbox id={id} checked={profileIds.includes(profile.profileId)} onChange={(event) => onToggle(profile.profileId, event.currentTarget.checked)} />
              <span className="text-sm">{pt(`tools.exports.profiles.${profileTranslationKeys[profile.profileId]}`)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export const WasteToolsExportSection = ({
  running,
  onStartExport,
}: {
  readonly running: boolean;
  readonly onStartExport: (
    input: StartWasteManagementExportInput
  ) => Promise<StudioJobResponse['data'] | null>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [profileIds, setProfileIds] = useState<readonly WasteManagementDataProfileId[]>([
    wasteManagementDataProfiles[0].profileId,
  ]);
  const [targetFormat, setTargetFormat] =
    useState<StartWasteManagementExportInput['targetFormat']>('application/json');

  const toggleProfile = (profileId: WasteManagementDataProfileId, checked: boolean) => {
    const nextProfileIds = checked
      ? [...new Set([...profileIds, profileId])]
      : profileIds.filter((candidate) => candidate !== profileId);
    setProfileIds(nextProfileIds);
    if (nextProfileIds.length > 1) {
      setTargetFormat('application/zip');
    }
  };

  const canStart =
    profileIds.length > 0 && (targetFormat === 'application/zip' || profileIds.length === 1);

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-background/80 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('tools.exports.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('tools.exports.description')}</p>
      </div>
      <WasteExportProfileSelector profileIds={profileIds} onToggle={toggleProfile} />
      <label className="block space-y-1 text-sm font-medium">
        <span>{pt('tools.exports.formatLabel')}</span>
        <Select
          value={targetFormat}
          onChange={(event) =>
            setTargetFormat(event.target.value as StartWasteManagementExportInput['targetFormat'])
          }
        >
          <option value="application/json" disabled={profileIds.length > 1}>
            {pt('tools.exports.formats.json')}
          </option>
          <option value="application/zip">{pt('tools.exports.formats.zip')}</option>
        </Select>
      </label>
      <p className="text-sm text-muted-foreground">{pt('tools.exports.privacyNotice')}</p>
      <Button
        type="button"
        disabled={running || !canStart}
        onClick={() => void onStartExport({ profileIds, targetFormat })}
      >
        {running ? pt('tools.actions.starting') : pt('tools.actions.startExport')}
      </Button>
    </section>
  );
};
