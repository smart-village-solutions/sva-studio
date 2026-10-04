import { t } from '../../i18n';
import {
  Button,
  StudioPersistentFormError,
  StudioSaveButton,
  type StudioSaveStatus,
} from '@sva/studio-ui-react';
import {
  instanceInterfaceTypeMeta,
  type InstanceInterfaceDraft,
  type InstanceInterfaceType,
} from '../../lib/instance-interfaces';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { MailTransportFields } from './-interfaces-page.mail-fields';
import { MapGeocodingFields } from './-interfaces-page.map-fields';
import {
  MainserverFields,
  PostgresqlFields,
  S3Fields,
  SupabaseFields,
} from './-interfaces-page.fields';

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
        <p className="mt-1 text-sm text-muted-foreground">
          {t('interfaces.create.dialogDescription')}
        </p>
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
          <Button type="button" variant="secondary" onClick={onCancel}>
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
  hasStoredMapApiKey?: boolean;
  saveStatus: StudioSaveStatus;
  saveErrorMessage: string | null;
  onChange: (next: InstanceInterfaceDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>;

export const InterfaceForm = ({
  draft,
  hasStoredMapApiKey = false,
  saveStatus,
  saveErrorMessage,
  onChange,
  onCancel,
  onSubmit,
}: InterfaceFormProps) => (
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
    ) : draft.type === 'mapGeocoding' ? (
      <MapGeocodingFields draft={draft} hasStoredApiKey={hasStoredMapApiKey} onChange={onChange} />
    ) : draft.type === 'mailTransport' ? (
      <MailTransportFields draft={draft} onChange={onChange} />
    ) : draft.type === 'postgresql' ? (
      <PostgresqlFields draft={draft} onChange={onChange} />
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

    {saveErrorMessage ? (
      <StudioPersistentFormError
        message={saveErrorMessage}
        retryLabel={t('interfaces.actions.retry')}
        retryDisabled={saveStatus === 'saving'}
        onRetry={onSubmit}
      />
    ) : null}

    <div className="flex flex-wrap gap-3">
      <StudioSaveButton
        type="submit"
        status={saveStatus}
        labels={{
          idle: t('interfaces.actions.save'),
          saving: t('interfaces.actions.saving'),
          saved: t('interfaces.actions.saved'),
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={saveStatus === 'saving'}
        onClick={onCancel}
      >
        {t('interfaces.edit.cancel')}
      </Button>
    </div>
  </form>
);
