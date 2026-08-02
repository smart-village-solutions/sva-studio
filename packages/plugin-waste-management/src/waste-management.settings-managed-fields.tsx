import { wasteManagementMasterDataContract, type WasteHolidayStateCode } from '@sva/plugin-sdk';
import { Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { SettingsFormState } from './waste-management.settings.shared.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const updateManagedField =
  (
    onChange: (
      next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)
    ) => void
  ) =>
  <Key extends keyof SettingsFormState>(key: Key, value: SettingsFormState[Key]) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

export const WasteSettingsTechnicalConfigFields = ({
  form,
  pt,
  onChange,
}: {
  readonly form: SettingsFormState;
  readonly pt: Translate;
  readonly onChange: (
    next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)
  ) => void;
}) => {
  const updateField = updateManagedField(onChange);

  return (
    <StudioFieldGroup>
      <StudioField id="waste-settings-schema-name" label={pt('settings.fields.schemaName')}>
        <Input
          id="waste-settings-schema-name"
          value={form.schemaName}
          disabled
          onChange={(event) => updateField('schemaName', event.target.value)}
          placeholder="public"
        />
      </StudioField>
      <div className="flex items-center gap-3">
        <WasteManagementFormSwitch
          checked={form.enabled}
          ariaLabel={pt('settings.fields.enabled')}
          onChange={(enabled) => updateField('enabled', enabled)}
        />
        <span className="text-sm text-muted-foreground">
          {form.enabled ? pt('common.active') : pt('common.inactive')}
        </span>
      </div>
    </StudioFieldGroup>
  );
};

export const WasteSettingsContentFields = ({
  form,
  pt,
  onChange,
}: {
  readonly form: SettingsFormState;
  readonly pt: Translate;
  readonly onChange: (
    next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)
  ) => void;
}) => {
  const updateField = updateManagedField(onChange);

  return (
    <StudioFieldGroup>
      <StudioField
        id="waste-settings-calendar-web-url"
        label={pt('settings.fields.calendarWebUrl')}
        description={pt('settings.messages.calendarWebUrlDescription')}
      >
        <Input
          id="waste-settings-calendar-web-url"
          type="url"
          value={form.calendarWebUrl}
          onChange={(event) => updateField('calendarWebUrl', event.target.value)}
          placeholder="https://abfall.example.de"
        />
      </StudioField>
      <StudioField
        id="waste-settings-holiday-state-code"
        label={pt('settings.fields.holidayStateCode')}
        description={pt('settings.messages.holidayStateDescription')}
      >
        <Select
          id="waste-settings-holiday-state-code"
          name="holidayStateCode"
          value={form.holidayStateCode}
          onChange={(event) =>
            updateField('holidayStateCode', event.currentTarget.value as WasteHolidayStateCode | '')
          }
        >
          <option value="">{pt('settings.fields.holidayStateCodePlaceholder')}</option>
          {wasteManagementMasterDataContract.holidayStateCodes.map((stateCode) => (
            <option key={stateCode} value={stateCode}>
              {stateCode}
            </option>
          ))}
        </Select>
      </StudioField>
    </StudioFieldGroup>
  );
};
