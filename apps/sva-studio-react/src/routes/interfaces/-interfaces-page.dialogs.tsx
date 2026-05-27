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
            const descriptionId = `${inputId}-description`;
            return (
              <label
                htmlFor={inputId}
                key={type}
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
                  aria-describedby={descriptionId}
                  checked={selectedType === type}
                  onChange={() => onSelectType(type)}
                />
                <div>
                  <span className="font-medium text-foreground">
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
