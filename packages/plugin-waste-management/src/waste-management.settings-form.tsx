import { usePluginTranslation, wasteManagementMasterDataContract, type WasteHolidayStateCode } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import { WasteSettingsCustomRecurrenceSection } from './waste-management.settings-custom-recurrence-section.js';

export type CustomRecurrencePresetInputState = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly intervalDays: number;
};

export type DeletedPresetFallbackState = {
  readonly kind: 'preset' | 'default';
  readonly value: string;
};

export type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly holidayStateCode: WasteHolidayStateCode | '';
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
  readonly customRecurrencePresets: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
};

export const WasteSettingsForm = ({
  form,
  saving,
  onSubmit,
  onChange,
}: {
  readonly form: SettingsFormState;
  readonly saving: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onChange: (next: SettingsFormState | ((current: SettingsFormState) => SettingsFormState)) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('settings.groupTitle')}</h3>
          <p className="text-sm text-muted-foreground">{pt('settings.groupDescription')}</p>
        </div>
        <StudioFieldGroup>
          <StudioField id="waste-settings-project-url" label={pt('settings.fields.projectUrl')}>
            <Input
              id="waste-settings-project-url"
              value={form.projectUrl}
              disabled
              onChange={(event) => onChange((current) => ({ ...current, projectUrl: event.target.value }))}
              placeholder="https://example.supabase.co"
            />
          </StudioField>
          <StudioField id="waste-settings-schema-name" label={pt('settings.fields.schemaName')}>
            <Input
              id="waste-settings-schema-name"
              value={form.schemaName}
              disabled
              onChange={(event) => onChange((current) => ({ ...current, schemaName: event.target.value }))}
              placeholder="public"
            />
          </StudioField>
          <StudioField id="waste-settings-database-url" label={pt('settings.fields.databaseUrl')}>
            <Input
              id="waste-settings-database-url"
              value={form.databaseUrl}
              disabled
              onChange={(event) => onChange((current) => ({ ...current, databaseUrl: event.target.value }))}
              placeholder="postgresql://..."
            />
          </StudioField>
          <StudioField id="waste-settings-service-role-key" label={pt('settings.fields.serviceRoleKey')}>
            <Input
              id="waste-settings-service-role-key"
              value={form.serviceRoleKey}
              disabled
              onChange={(event) => onChange((current) => ({ ...current, serviceRoleKey: event.target.value }))}
              placeholder="service-role-key"
            />
          </StudioField>
          <div className="flex items-center gap-3">
            <WasteManagementFormSwitch
              checked={form.enabled}
              ariaLabel={pt('settings.fields.enabled')}
              onChange={(enabled) => onChange((current) => ({ ...current, enabled }))}
            />
            <span className="text-sm text-muted-foreground">{form.enabled ? pt('common.active') : pt('common.inactive')}</span>
          </div>
          <StudioField
            id="waste-settings-holiday-state-code"
            label={pt('settings.fields.holidayStateCode')}
            description={pt('settings.messages.holidayStateDescription')}
          >
            <Select
              id="waste-settings-holiday-state-code"
              value={form.holidayStateCode}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  holidayStateCode: event.target.value as WasteHolidayStateCode | '',
                }))
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
        <p className="text-xs text-muted-foreground">{pt('settings.messages.connectionManagedHint')}</p>
      </div>
      <WasteSettingsCustomRecurrenceSection
        items={form.customRecurrencePresets}
        deletedPresetFallbacks={form.deletedPresetFallbacks}
        onChange={(customRecurrencePresets, deletedPresetFallbacks) =>
          onChange((current) => ({ ...current, customRecurrencePresets, deletedPresetFallbacks }))
        }
      />
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? pt('settings.actions.saving') : pt('settings.actions.save')}
        </Button>
      </div>
    </form>
  );
};
