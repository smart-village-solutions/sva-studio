import type { FieldPath } from 'react-hook-form';
import {
  StudioField,
  StudioFormSummaryErrors,
  StudioSaveButton,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { t } from '../../../i18n';
import type { ConfigurationSectionProps } from './-instance-detail-view-shared';
import type { DetailFormValues } from './-instances-shared-types';
import { AccountInvitationTemplateCard } from './-account-invitation-template-card';

const fields = [
  ['displayName', 'detail-display-name', 'displayName'],
  ['parentDomain', 'detail-parent-domain', 'parentDomain'],
  ['tenantAdminBootstrap.username', 'detail-admin-username', 'tenantAdminUsername'],
  ['tenantAdminBootstrap.email', 'detail-admin-email', 'tenantAdminEmail'],
  ['tenantAdminBootstrap.firstName', 'detail-admin-first-name', 'tenantAdminFirstName'],
  ['tenantAdminBootstrap.lastName', 'detail-admin-last-name', 'tenantAdminLastName'],
  ['authRealm', 'detail-auth-realm', 'authRealm'],
  ['authClientId', 'detail-auth-client-id', 'authClientId'],
  ['authIssuerUrl', 'detail-auth-issuer-url', 'authIssuerUrl'],
  ['tenantAdminClient.clientId', 'detail-tenant-admin-client-id', 'tenantAdminClientId'],
  ['authClientSecret', 'detail-auth-client-secret', 'authClientSecret'],
  ['tenantAdminClient.secret', 'detail-tenant-admin-client-secret', 'tenantAdminClientSecret'],
] as const satisfies readonly (readonly [FieldPath<DetailFormValues>, string, string])[];

export const InstanceDetailConfigurationSection = ({
  selectedInstance,
  detailFormValues,
  tenantSecretUserInputRequired,
  setDetailFormValues,
  onUpdateSubmit,
  saveStatus = 'idle',
  onSaveAccountInvitationTemplate,
  form,
  saving,
}: ConfigurationSectionProps) => {
  const errorFields = fields.flatMap(([name, id]) => {
    const message = form?.getFieldState(name, form.formState).error?.message;
    return message ? [{ field: id, message }] : [];
  });
  const renderFields = (start: number, end: number) =>
    fields.slice(start, end).map(([name, id, label]) => {
      const [key, nestedKey] = name.split('.') as [keyof DetailFormValues, string | undefined];
      const section = detailFormValues[key];
      const value =
        typeof section === 'object' && nestedKey
          ? (Reflect.get(section, nestedKey) as string)
          : (section as string);
      const isSecret = name === 'authClientSecret' || name === 'tenantAdminClient.secret';
      const configured =
        name === 'authClientSecret'
          ? selectedInstance.authClientSecretConfigured
          : selectedInstance.tenantAdminClient?.secretConfigured;
      const binding = getStudioFormFieldProps({
        id,
        error: form?.getFieldState(name, form.formState).error,
      });
      return (
        <StudioField key={name} {...binding} label={t(`admin.instances.form.${label}`)}>
          <Input
            value={value}
            type={isSecret ? 'password' : name === 'tenantAdminBootstrap.email' ? 'email' : 'text'}
            disabled={saving || (isSecret && !tenantSecretUserInputRequired)}
            placeholder={
              isSecret
                ? t(
                    !tenantSecretUserInputRequired
                      ? 'admin.instances.form.authClientSecretGeneratedDuringProvisioning'
                      : configured
                        ? 'admin.instances.form.authClientSecretConfigured'
                        : 'admin.instances.form.authClientSecretMissing'
                  )
                : undefined
            }
            onChange={(event) =>
              setDetailFormValues((current) =>
                current
                  ? {
                      ...current,
                      [key]:
                        nestedKey && typeof current[key] === 'object'
                          ? { ...current[key], [nestedKey]: event.target.value }
                          : event.target.value,
                    }
                  : current
              )
            }
          />
        </StudioField>
      );
    });
  const openError = (field: string) => {
    const input = document.getElementById(field);
    const disclosure = input?.closest('details');
    if (disclosure) disclosure.open = true;
  };
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form className="space-y-5" noValidate onSubmit={(event) => void onUpdateSubmit(event)}>
          <div id="instance-settings-errors" tabIndex={-1}>
            <StudioFormSummaryErrors
              errors={errorFields}
              title={t('account.messages.validationSummary')}
              onSelectError={({ field }) => openError(field)}
            />
          </div>
          <section className="space-y-3">
            <h2 className="font-medium">{t('admin.instances.form.general')}</h2>
            <div className="grid gap-3 md:grid-cols-2">{renderFields(0, 2)}</div>
          </section>
          <section className="space-y-3">
            <h2 className="font-medium">{t('admin.instances.wizard.steps.tenantAdmin.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.instances.form.tenantAdminSubtitle')}
            </p>
            <div className="grid gap-3 md:grid-cols-2">{renderFields(2, 6)}</div>
          </section>

          <AccountInvitationTemplateCard
            instance={selectedInstance}
            disabled={saving}
            onSave={onSaveAccountInvitationTemplate ?? (async () => false)}
          />
          <details className="space-y-3 rounded-md border border-border p-3">
            <summary className="cursor-pointer font-medium">
              {t('admin.instances.form.realmAndClients')} · {selectedInstance.authRealm}
            </summary>
            <fieldset className="flex flex-wrap gap-3" disabled={saving}>
              <legend className="text-sm">{t('admin.instances.flow.realmModeTitle')}</legend>
              {(['new', 'existing'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="detail-realm-mode"
                    checked={detailFormValues.realmMode === mode}
                    onChange={() =>
                      setDetailFormValues((current) =>
                        current ? { ...current, realmMode: mode } : current
                      )
                    }
                  />
                  {t(
                    mode === 'new'
                      ? 'admin.instances.flow.realmModeNew'
                      : 'admin.instances.flow.realmModeExisting'
                  )}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-3 md:grid-cols-2">{renderFields(6, 10)}</div>
          </details>
          <div className="space-y-2">
            {tenantSecretUserInputRequired &&
            (!selectedInstance.authClientSecretConfigured ||
              !selectedInstance.tenantAdminClient?.secretConfigured) ? (
              <p role="status" className="text-sm">
                {t('admin.instances.form.authClientSecretMissing')}
              </p>
            ) : null}
            <details className="space-y-3 rounded-md border border-border p-3">
              <summary className="cursor-pointer font-medium">
                {t('admin.instances.form.credentials')}
              </summary>
              <p className="text-sm text-muted-foreground">
                {t(
                  tenantSecretUserInputRequired
                    ? 'admin.instances.form.authClientSecretHint'
                    : 'admin.instances.form.authClientSecretGeneratedHint'
                )}
              </p>
              <div className="grid gap-3 md:grid-cols-2">{renderFields(10, 12)}</div>
            </details>
          </div>
          <StudioSaveButton
            type="submit"
            status={saveStatus}
            disabled={saving}
            labels={{
              idle: t('admin.instances.actions.save'),
              saving: t('account.actions.saving'),
              saved: t('account.actions.saved'),
            }}
          />
          {form?.formState.isDirty ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('admin.instances.form.unsaved')}
            </p>
          ) : null}
        </form>
      </Card>
    </div>
  );
};
