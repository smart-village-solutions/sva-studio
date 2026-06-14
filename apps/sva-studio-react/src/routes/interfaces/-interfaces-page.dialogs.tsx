import { t } from '../../i18n';
import { instanceInterfaceTypeMeta, type InstanceInterfaceDraft, type InstanceInterfaceType } from '../../lib/instance-interfaces';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';

type TypePickerDialogProps = Readonly<{
  open: boolean;
  availableTypes: readonly InstanceInterfaceType[];
  selectedType: InstanceInterfaceType;
  onSelectType: (type: InstanceInterfaceType) => void;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export const TypePickerDialog = ({
  open,
  availableTypes,
  selectedType,
  onSelectType,
  onCancel,
  onConfirm,
}: TypePickerDialogProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('interfaces.create.dialogTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-shell">
        <h2 className="text-lg font-semibold">{t('interfaces.create.dialogTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('interfaces.create.dialogDescription')}</p>
        <div className="mt-4 grid gap-3">
          {availableTypes.map((type) => {
            const meta = instanceInterfaceTypeMeta[type];
            const inputId = `interface-type-${type}`;
            const titleId = `${inputId}-title`;
            const descriptionId = `${inputId}-description`;
            return (
              <label
                htmlFor={inputId}
                key={type}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  selectedType === type
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="interface-type"
                  className="mt-1"
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  checked={selectedType === type}
                  onChange={() => onSelectType(type)}
                />
                <div>
                  <span id={titleId} className="font-medium text-foreground">
                    {t(meta.titleKey)}
                  </span>
                  <p id={descriptionId} className="text-xs text-muted-foreground">
                    {t(meta.descriptionKey)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('interfaces.create.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t('interfaces.create.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
};

type InterfaceFormProps = Readonly<{
  draft: InstanceInterfaceDraft;
  isSaving: boolean;
  onChange: (next: InstanceInterfaceDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>;

export const InterfaceForm = ({ draft, isSaving, onChange, onCancel, onSubmit }: InterfaceFormProps) => (
  <form
    className="grid gap-4"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <div className="grid gap-2">
      <Label htmlFor="interface-name">{t('interfaces.edit.commonName')}</Label>
      <Input
        id="interface-name"
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.currentTarget.value })}
      />
    </div>

    {draft.type === 'mainserver' ? (
      <MainserverFields draft={draft} onChange={onChange} />
    ) : draft.type === 's3' ? (
      <S3Fields draft={draft} onChange={onChange} />
    ) : draft.type === 'mailTransport' ? (
      <MailTransportFields draft={draft} onChange={onChange} />
    ) : (
      <SupabaseFields draft={draft} onChange={onChange} />
    )}

    <div className="flex items-center gap-3">
      <Switch
        id="interface-enabled"
        checked={draft.enabled}
        aria-label={t('interfaces.edit.commonEnabled')}
        onCheckedChange={(enabled) => onChange({ ...draft, enabled })}
      />
      <span className="text-sm text-muted-foreground">
        {draft.enabled ? t('account.status.active') : t('account.status.inactive')}
      </span>
    </div>

    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={isSaving}>
        {isSaving ? t('interfaces.actions.saving') : t('interfaces.actions.save')}
      </Button>
      <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
        {t('interfaces.edit.cancel')}
      </Button>
    </div>
  </form>
);

const MainserverFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'mainserver' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="mainserver-graphql">{t('interfaces.form.graphqlBaseUrl')}</Label>
      <Input
        id="mainserver-graphql"
        type="url"
        value={draft.config.graphqlBaseUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, graphqlBaseUrl: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="mainserver-oauth">{t('interfaces.form.oauthTokenUrl')}</Label>
      <Input
        id="mainserver-oauth"
        type="url"
        value={draft.config.oauthTokenUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, oauthTokenUrl: event.currentTarget.value } })
        }
      />
    </div>
  </>
);

const S3Fields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 's3' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="s3-endpoint">{t('interfaces.forms.s3.endpoint')}</Label>
      <Input
        id="s3-endpoint"
        type="url"
        value={draft.config.endpoint}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, endpoint: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="s3-region">{t('interfaces.forms.s3.region')}</Label>
        <Input
          id="s3-region"
          value={draft.config.region}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, region: event.currentTarget.value } })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="s3-bucket">{t('interfaces.forms.s3.bucket')}</Label>
        <Input
          id="s3-bucket"
          value={draft.config.bucket}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, bucket: event.currentTarget.value } })
          }
        />
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="s3-access-key">{t('interfaces.forms.s3.accessKeyId')}</Label>
      <Input
        id="s3-access-key"
        value={draft.config.accessKeyId}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, accessKeyId: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="s3-secret-key">{t('interfaces.forms.s3.secretAccessKey')}</Label>
      <Input
        id="s3-secret-key"
        type="password"
        value={draft.config.secretAccessKey}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, secretAccessKey: event.currentTarget.value } })
        }
      />
    </div>
    <Label htmlFor="s3-path-style" className="flex items-center gap-3">
      <Checkbox
        id="s3-path-style"
        checked={draft.config.forcePathStyle}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, forcePathStyle: event.currentTarget.checked },
          })
        }
      />
      <span>{t('interfaces.forms.s3.forcePathStyle')}</span>
    </Label>
  </>
);

const SupabaseFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'supabase' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="supabase-project">{t('interfaces.forms.supabase.projectUrl')}</Label>
      <Input
        id="supabase-project"
        type="url"
        value={draft.config.projectUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, projectUrl: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="supabase-schema">{t('interfaces.forms.supabase.schemaName')}</Label>
        <Input
          id="supabase-schema"
          value={draft.config.schemaName}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, schemaName: event.currentTarget.value } })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supabase-db">{t('interfaces.forms.supabase.databaseUrl')}</Label>
        <Input
          id="supabase-db"
          value={draft.config.databaseUrl}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, databaseUrl: event.currentTarget.value } })
          }
        />
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="supabase-key">{t('interfaces.forms.supabase.serviceRoleKey')}</Label>
      <Input
        id="supabase-key"
        type="password"
        value={draft.config.serviceRoleKey}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, serviceRoleKey: event.currentTarget.value } })
        }
      />
    </div>
  </>
);

const MailTransportFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => {
  const updateConfig = (
    patch: Partial<Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>['config']>
  ) => {
    onChange({
      ...draft,
      config: {
        ...draft.config,
        ...patch,
      },
    });
  };

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-transport-id">{t('interfaces.forms.mailTransport.transportId')}</Label>
          <Input
            id="mail-transport-id"
            value={draft.config.transportId}
            onChange={(event) => updateConfig({ transportId: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-transport-type">{t('interfaces.forms.mailTransport.transportType')}</Label>
          <select
            id="mail-transport-type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.config.transportType}
            onChange={(event) =>
              updateConfig({
                transportType: event.currentTarget.value as typeof draft.config.transportType,
              })
            }
          >
            <option value="smtp">{t('interfaces.forms.mailTransport.transportTypeOptions.smtp')}</option>
            <option value="provider_api">
              {t('interfaces.forms.mailTransport.transportTypeOptions.providerApi')}
            </option>
          </select>
        </div>
      </div>

      {draft.config.transportType === 'smtp' ? (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mail-host">{t('interfaces.forms.mailTransport.host')}</Label>
            <Input
              id="mail-host"
              value={draft.config.host}
              onChange={(event) => updateConfig({ host: event.currentTarget.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mail-port">{t('interfaces.forms.mailTransport.port')}</Label>
            <Input
              id="mail-port"
              inputMode="numeric"
              value={draft.config.port}
              onChange={(event) => updateConfig({ port: event.currentTarget.value })}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mail-endpoint">{t('interfaces.forms.mailTransport.endpoint')}</Label>
            <Input
              id="mail-endpoint"
              type="url"
              value={draft.config.endpoint}
              onChange={(event) => updateConfig({ endpoint: event.currentTarget.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mail-provider-mode">{t('interfaces.forms.mailTransport.providerMode')}</Label>
            <Input
              id="mail-provider-mode"
              value={draft.config.providerMode}
              onChange={(event) => updateConfig({ providerMode: event.currentTarget.value })}
            />
          </div>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-security-mode">{t('interfaces.forms.mailTransport.securityMode')}</Label>
          <select
            id="mail-security-mode"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.config.securityMode}
            onChange={(event) =>
              updateConfig({
                securityMode: event.currentTarget.value as typeof draft.config.securityMode,
              })
            }
          >
            <option value="none">{t('interfaces.forms.mailTransport.securityModeOptions.none')}</option>
            <option value="starttls">
              {t('interfaces.forms.mailTransport.securityModeOptions.starttls')}
            </option>
            <option value="tls">{t('interfaces.forms.mailTransport.securityModeOptions.tls')}</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-auth-mode">{t('interfaces.forms.mailTransport.authMode')}</Label>
          <select
            id="mail-auth-mode"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.config.authMode}
            onChange={(event) =>
              updateConfig({
                authMode: event.currentTarget.value as typeof draft.config.authMode,
              })
            }
          >
            <option value="none">{t('interfaces.forms.mailTransport.authModeOptions.none')}</option>
            <option value="basic">{t('interfaces.forms.mailTransport.authModeOptions.basic')}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-username">{t('interfaces.forms.mailTransport.username')}</Label>
          <Input
            id="mail-username"
            value={draft.config.username}
            onChange={(event) => updateConfig({ username: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-password">{t('interfaces.forms.mailTransport.password')}</Label>
          <Input
            id="mail-password"
            type="password"
            value={draft.config.password}
            onChange={(event) => updateConfig({ password: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-default-from-email">
            {t('interfaces.forms.mailTransport.defaultFromEmail')}
          </Label>
          <Input
            id="mail-default-from-email"
            type="email"
            value={draft.config.defaultFromEmail}
            onChange={(event) => updateConfig({ defaultFromEmail: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-default-from-name">
            {t('interfaces.forms.mailTransport.defaultFromName')}
          </Label>
          <Input
            id="mail-default-from-name"
            value={draft.config.defaultFromName}
            onChange={(event) => updateConfig({ defaultFromName: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-default-reply-to">
            {t('interfaces.forms.mailTransport.defaultReplyToEmail')}
          </Label>
          <Input
            id="mail-default-reply-to"
            type="email"
            value={draft.config.defaultReplyToEmail}
            onChange={(event) => updateConfig({ defaultReplyToEmail: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-rate-limit">{t('interfaces.forms.mailTransport.rateLimitPerMinute')}</Label>
          <Input
            id="mail-rate-limit"
            inputMode="numeric"
            value={draft.config.rateLimitPerMinute}
            onChange={(event) => updateConfig({ rateLimitPerMinute: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="mail-max-batch-size">{t('interfaces.forms.mailTransport.maxBatchSize')}</Label>
        <Input
          id="mail-max-batch-size"
          inputMode="numeric"
          value={draft.config.maxBatchSize}
          onChange={(event) => updateConfig({ maxBatchSize: event.currentTarget.value })}
        />
      </div>
    </>
  );
};
