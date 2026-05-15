import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { t } from '../../../i18n';
import { FieldHelp } from './-field-help';
import { INSTANCE_FIELD_HELP } from './-instance-form-models';
import { ConfigurationStatusBadge } from './-instance-status-badges';
import { FormLabelWithHelp, INSTANCE_STATUS_LABELS } from './-instance-detail-view-shared';

import type { ConfigurationSectionProps } from './-instance-detail-view-shared';
import type { DetailFormValues } from './-instances-shared-types';

const updateFormField =
  <T extends keyof DetailFormValues>(
    setDetailFormValues: ConfigurationSectionProps['setDetailFormValues'],
    key: T
  ) =>
  (value: DetailFormValues[T]) =>
    setDetailFormValues((current) => (current ? { ...current, [key]: value } : current));

const updateNestedField =
  <T extends 'tenantAdminClient' | 'tenantAdminBootstrap', K extends keyof DetailFormValues[T]>(
    setDetailFormValues: ConfigurationSectionProps['setDetailFormValues'],
    section: T,
    key: K
  ) =>
  (value: DetailFormValues[T][K]) =>
    setDetailFormValues((current) =>
      current ? { ...current, [section]: { ...current[section], [key]: value } } : current
    );

const ConfigurationAssessmentCard = ({
  configurationAssessment,
  selectedInstance,
}: Pick<ConfigurationSectionProps, 'configurationAssessment' | 'selectedInstance'>) =>
  configurationAssessment ? (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{t('admin.instances.configuration.title')}</div>
          <p className="text-sm text-muted-foreground">{configurationAssessment.title}</p>
        </div>
        <ConfigurationStatusBadge status={configurationAssessment.overallStatus} />
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.instances.configuration.labels.lifecycle')}
          </div>
          <div className="mt-1 font-medium text-foreground">{t(INSTANCE_STATUS_LABELS[selectedInstance.status])}</div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.instances.configuration.labels.requirements')}
          </div>
          <div className="mt-1 font-medium text-foreground">
            {t('admin.instances.configuration.labels.requirementsValue', {
              satisfied: configurationAssessment.satisfiedRequirements,
              total: configurationAssessment.totalRequirements,
            })}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{configurationAssessment.body}</p>
      {configurationAssessment.blockingIssues.length > 0 ? (
        <IssueList
          title={t('admin.instances.configuration.labels.blockingIssues')}
          items={configurationAssessment.blockingIssues.map((issue) => issue.label)}
        />
      ) : null}
      {configurationAssessment.warningIssues.length > 0 ? (
        <IssueList
          title={t('admin.instances.configuration.labels.warnings')}
          items={configurationAssessment.warningIssues.map((issue) => issue.label)}
        />
      ) : null}
    </Card>
  ) : null
;

const IssueList = ({ title, items }: { title: string; items: readonly string[] }) => (
  <div className="space-y-2">
    <div className="text-sm font-medium text-foreground">{title}</div>
    <ul className="space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);

const RealmModeSelector = ({
  realmMode,
  onChange,
}: {
  realmMode: DetailFormValues['realmMode'];
  onChange: (value: DetailFormValues['realmMode']) => void;
}) => (
  <>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-foreground">{t('admin.instances.flow.realmModeTitle')}</h2>
        <FieldHelp {...INSTANCE_FIELD_HELP.realmMode} />
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.flow.realmModeSubtitle')}</p>
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <input type="radio" name="detail-realm-mode" checked={realmMode === 'new'} onChange={() => onChange('new')} />
        <span>{t('admin.instances.flow.realmModeNew')}</span>
      </label>
      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="radio"
          name="detail-realm-mode"
          checked={realmMode === 'existing'}
          onChange={() => onChange('existing')}
        />
        <span>{t('admin.instances.flow.realmModeExisting')}</span>
      </label>
    </div>
  </>
);

const AuthSettingsFields = ({
  detailFormValues,
  setDetailFormValues,
}: Pick<ConfigurationSectionProps, 'detailFormValues' | 'setDetailFormValues'>) => {
  const updateDisplayName = updateFormField(setDetailFormValues, 'displayName');
  const updateParentDomain = updateFormField(setDetailFormValues, 'parentDomain');
  const updateAuthRealm = updateFormField(setDetailFormValues, 'authRealm');
  const updateAuthClientId = updateFormField(setDetailFormValues, 'authClientId');
  const updateAuthIssuerUrl = updateFormField(setDetailFormValues, 'authIssuerUrl');

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-display-name" label={t('admin.instances.form.displayName')} helpKey="displayName" />
          <Input id="detail-display-name" value={detailFormValues.displayName} onChange={(event) => updateDisplayName(event.target.value)} />
        </div>
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-parent-domain" label={t('admin.instances.form.parentDomain')} helpKey="parentDomain" />
          <Input id="detail-parent-domain" value={detailFormValues.parentDomain} onChange={(event) => updateParentDomain(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-auth-realm" label={t('admin.instances.form.authRealm')} helpKey="authRealm" />
          <Input id="detail-auth-realm" value={detailFormValues.authRealm} onChange={(event) => updateAuthRealm(event.target.value)} />
        </div>
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-auth-client-id" label={t('admin.instances.form.authClientId')} helpKey="authClientId" />
          <Input id="detail-auth-client-id" value={detailFormValues.authClientId} onChange={(event) => updateAuthClientId(event.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <FormLabelWithHelp htmlFor="detail-auth-issuer-url" label={t('admin.instances.form.authIssuerUrl')} helpKey="authIssuerUrl" />
        <Input id="detail-auth-issuer-url" value={detailFormValues.authIssuerUrl} onChange={(event) => updateAuthIssuerUrl(event.target.value)} />
      </div>
    </>
  );
};

const TenantSecretField = ({
  detailFormValues,
  selectedInstance,
  tenantSecretUserInputRequired,
  setDetailFormValues,
}: Pick<
  ConfigurationSectionProps,
  'detailFormValues' | 'selectedInstance' | 'tenantSecretUserInputRequired' | 'setDetailFormValues'
>) => {
  const updateAuthClientSecret = updateFormField(setDetailFormValues, 'authClientSecret');

  return (
    <div className="space-y-1">
      <FormLabelWithHelp htmlFor="detail-auth-client-secret" label={t('admin.instances.form.authClientSecret')} helpKey="authClientSecret" />
      <Input
        id="detail-auth-client-secret"
        type="password"
        disabled={!tenantSecretUserInputRequired}
        placeholder={
          !tenantSecretUserInputRequired
            ? t('admin.instances.form.authClientSecretGeneratedDuringProvisioning')
            : selectedInstance.authClientSecretConfigured
              ? t('admin.instances.form.authClientSecretConfigured')
              : t('admin.instances.form.authClientSecretMissing')
        }
        value={detailFormValues.authClientSecret}
        onChange={(event) => updateAuthClientSecret(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {tenantSecretUserInputRequired
          ? t('admin.instances.form.authClientSecretHint')
          : t('admin.instances.form.authClientSecretGeneratedHint')}
      </p>
    </div>
  );
};

const TenantAdminClientFields = ({
  detailFormValues,
  selectedInstance,
  tenantSecretUserInputRequired,
  setDetailFormValues,
}: Pick<
  ConfigurationSectionProps,
  'detailFormValues' | 'selectedInstance' | 'tenantSecretUserInputRequired' | 'setDetailFormValues'
>) => {
  const updateClientId = updateNestedField(setDetailFormValues, 'tenantAdminClient', 'clientId');
  const updateSecret = updateNestedField(setDetailFormValues, 'tenantAdminClient', 'secret');

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminClientTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminClientSubtitle')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-tenant-admin-client-id" label={t('admin.instances.form.tenantAdminClientId')} helpKey="tenantAdminClientId" />
          <Input id="detail-tenant-admin-client-id" value={detailFormValues.tenantAdminClient.clientId} onChange={(event) => updateClientId(event.target.value)} />
        </div>
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-tenant-admin-client-secret" label={t('admin.instances.form.tenantAdminClientSecret')} helpKey="tenantAdminClientSecret" />
          <Input
            id="detail-tenant-admin-client-secret"
            type="password"
            disabled={!tenantSecretUserInputRequired}
            placeholder={
              !tenantSecretUserInputRequired
                ? t('admin.instances.form.authClientSecretGeneratedDuringProvisioning')
                : selectedInstance.tenantAdminClient?.secretConfigured
                  ? t('admin.instances.form.tenantAdminClientSecretConfigured')
                  : t('admin.instances.form.tenantAdminClientSecretMissing')
            }
            value={detailFormValues.tenantAdminClient.secret}
            onChange={(event) => updateSecret(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {tenantSecretUserInputRequired
              ? t('admin.instances.form.tenantAdminClientSecretHint')
              : t('admin.instances.form.authClientSecretGeneratedHint')}
          </p>
        </div>
      </div>
    </>
  );
};

const TenantAdminFields = ({
  detailFormValues,
  setDetailFormValues,
}: Pick<ConfigurationSectionProps, 'detailFormValues' | 'setDetailFormValues'>) => {
  const updateUsername = updateNestedField(setDetailFormValues, 'tenantAdminBootstrap', 'username');
  const updateEmail = updateNestedField(setDetailFormValues, 'tenantAdminBootstrap', 'email');
  const updateFirstName = updateNestedField(setDetailFormValues, 'tenantAdminBootstrap', 'firstName');
  const updateLastName = updateNestedField(setDetailFormValues, 'tenantAdminBootstrap', 'lastName');

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminSubtitle')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-admin-username" label={t('admin.instances.form.tenantAdminUsername')} helpKey="tenantAdminUsername" />
          <Input id="detail-admin-username" value={detailFormValues.tenantAdminBootstrap.username} onChange={(event) => updateUsername(event.target.value)} />
        </div>
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-admin-email" label={t('admin.instances.form.tenantAdminEmail')} helpKey="tenantAdminEmail" />
          <Input id="detail-admin-email" value={detailFormValues.tenantAdminBootstrap.email} onChange={(event) => updateEmail(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-admin-first-name" label={t('admin.instances.form.tenantAdminFirstName')} helpKey="tenantAdminFirstName" />
          <Input id="detail-admin-first-name" value={detailFormValues.tenantAdminBootstrap.firstName} onChange={(event) => updateFirstName(event.target.value)} />
        </div>
        <div className="space-y-1">
          <FormLabelWithHelp htmlFor="detail-admin-last-name" label={t('admin.instances.form.tenantAdminLastName')} helpKey="tenantAdminLastName" />
          <Input id="detail-admin-last-name" value={detailFormValues.tenantAdminBootstrap.lastName} onChange={(event) => updateLastName(event.target.value)} />
        </div>
      </div>
    </>
  );
};

export const InstanceDetailConfigurationSection = ({
  selectedInstance,
  detailFormValues,
  configurationAssessment,
  tenantSecretUserInputRequired,
  setDetailFormValues,
  onUpdateSubmit,
}: ConfigurationSectionProps) => {
  const updateRealmMode = updateFormField(setDetailFormValues, 'realmMode');

  return (
    <>
      <ConfigurationAssessmentCard configurationAssessment={configurationAssessment} selectedInstance={selectedInstance} />

      <Card className="space-y-5 p-4">
        <form className="space-y-4" onSubmit={(event) => void onUpdateSubmit(event)}>
          <RealmModeSelector realmMode={detailFormValues.realmMode} onChange={updateRealmMode} />
          <AuthSettingsFields detailFormValues={detailFormValues} setDetailFormValues={setDetailFormValues} />
          <TenantSecretField
            detailFormValues={detailFormValues}
            selectedInstance={selectedInstance}
            tenantSecretUserInputRequired={tenantSecretUserInputRequired}
            setDetailFormValues={setDetailFormValues}
          />
          <TenantAdminClientFields
            detailFormValues={detailFormValues}
            selectedInstance={selectedInstance}
            tenantSecretUserInputRequired={tenantSecretUserInputRequired}
            setDetailFormValues={setDetailFormValues}
          />
          <TenantAdminFields detailFormValues={detailFormValues} setDetailFormValues={setDetailFormValues} />
          <Button type="submit" variant="outline">
            {t('admin.instances.actions.save')}
          </Button>
        </form>
      </Card>
    </>
  );
};
