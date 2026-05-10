import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type { FormEvent } from 'react';

type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
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
              onChange={(event) => onChange((current) => ({ ...current, projectUrl: event.target.value }))}
              placeholder="https://example.supabase.co"
            />
          </StudioField>
          <StudioField id="waste-settings-schema-name" label={pt('settings.fields.schemaName')}>
            <Input
              id="waste-settings-schema-name"
              value={form.schemaName}
              onChange={(event) => onChange((current) => ({ ...current, schemaName: event.target.value }))}
              placeholder="public"
            />
          </StudioField>
          <StudioField id="waste-settings-database-url" label={pt('settings.fields.databaseUrl')}>
            <Input
              id="waste-settings-database-url"
              value={form.databaseUrl}
              onChange={(event) => onChange((current) => ({ ...current, databaseUrl: event.target.value }))}
              placeholder="postgresql://..."
            />
          </StudioField>
          <StudioField id="waste-settings-service-role-key" label={pt('settings.fields.serviceRoleKey')}>
            <Input
              id="waste-settings-service-role-key"
              value={form.serviceRoleKey}
              onChange={(event) => onChange((current) => ({ ...current, serviceRoleKey: event.target.value }))}
              placeholder="service-role-key"
            />
          </StudioField>
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox
              id="waste-settings-enabled"
              checked={form.enabled}
              onChange={(event) => onChange((current) => ({ ...current, enabled: event.target.checked }))}
              aria-label={pt('settings.fields.enabled')}
            />
            <span>{pt('settings.fields.enabled')}</span>
          </label>
        </StudioFieldGroup>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? pt('settings.actions.saving') : pt('settings.actions.save')}
      </Button>
    </form>
  );
};
