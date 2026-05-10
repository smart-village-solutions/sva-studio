import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import type { WasteManagementSettingsFormValues } from './-instances-shared-types';

type WasteManagementSettingsFieldsProps = {
  readonly idPrefix: string;
  readonly value: WasteManagementSettingsFormValues;
  readonly onChange: (updater: (current: WasteManagementSettingsFormValues) => WasteManagementSettingsFormValues) => void;
  readonly showConfiguredHints?: boolean;
  readonly databaseUrlConfigured?: boolean;
  readonly serviceRoleKeyConfigured?: boolean;
};

export const WasteManagementSettingsFields = ({
  idPrefix,
  value,
  onChange,
  showConfiguredHints = false,
  databaseUrlConfigured = false,
  serviceRoleKeyConfigured = false,
}: WasteManagementSettingsFieldsProps) => (
  <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <input
          id={`${idPrefix}-waste-enabled`}
          type="checkbox"
          checked={value.enabled}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              enabled: event.target.checked,
            }))
          }
        />
        <Label htmlFor={`${idPrefix}-waste-enabled`} className="font-medium">
          {t('admin.instances.form.wasteManagementEnabled')}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.form.wasteManagementSubtitle')}</p>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor={`${idPrefix}-waste-project-url`}>
          {t('admin.instances.form.wasteManagementProjectUrl')}
        </Label>
        <Input
          id={`${idPrefix}-waste-project-url`}
          type="url"
          required={value.enabled}
          disabled={!value.enabled}
          value={value.projectUrl}
          placeholder="https://example.supabase.co"
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              projectUrl: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-waste-schema-name`}>
          {t('admin.instances.form.wasteManagementSchemaName')}
        </Label>
        <Input
          id={`${idPrefix}-waste-schema-name`}
          disabled={!value.enabled}
          value={value.schemaName}
          placeholder="public"
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              schemaName: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-waste-provider`}>
          {t('admin.instances.form.wasteManagementProvider')}
        </Label>
        <Input
          id={`${idPrefix}-waste-provider`}
          disabled
          value={value.provider}
          aria-readonly="true"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-waste-database-url`}>
          {t('admin.instances.form.wasteManagementDatabaseUrl')}
        </Label>
        <Input
          id={`${idPrefix}-waste-database-url`}
          type="password"
          disabled={!value.enabled}
          value={value.databaseUrl}
          placeholder={
            showConfiguredHints && databaseUrlConfigured
              ? t('admin.instances.form.wasteManagementDatabaseUrlConfigured')
              : undefined
          }
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              databaseUrl: event.target.value,
            }))
          }
        />
        <p className="text-xs text-muted-foreground">
          {showConfiguredHints
            ? t('admin.instances.form.wasteManagementDatabaseUrlHint')
            : t('admin.instances.form.wasteManagementDatabaseUrlCreateHint')}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-waste-service-role-key`}>
          {t('admin.instances.form.wasteManagementServiceRoleKey')}
        </Label>
        <Input
          id={`${idPrefix}-waste-service-role-key`}
          type="password"
          disabled={!value.enabled}
          value={value.serviceRoleKey}
          placeholder={
            showConfiguredHints && serviceRoleKeyConfigured
              ? t('admin.instances.form.wasteManagementServiceRoleKeyConfigured')
              : undefined
          }
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              serviceRoleKey: event.target.value,
            }))
          }
        />
        <p className="text-xs text-muted-foreground">
          {showConfiguredHints
            ? t('admin.instances.form.wasteManagementServiceRoleKeyHint')
            : t('admin.instances.form.wasteManagementServiceRoleKeyCreateHint')}
        </p>
      </div>
    </div>
  </div>
);
