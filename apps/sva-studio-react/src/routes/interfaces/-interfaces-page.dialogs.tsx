import { SsfFields, TranslationCheck } from './-interfaces-page.translation-fields';
import type { InstanceInterface } from '../../lib/instance-interfaces';
import { DeepLFields } from './-interfaces-page.deepl-fields';
import { t } from '../../i18n';
import {
  Radio,
  Button,
  StudioPersistentFormError,
  StudioSaveButton,
  type StudioSaveStatus,
} from '@sva/studio-ui-react';
import {
  instanceInterfaceTypeMeta,
  type InstanceInterfaceDeepL,
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
                <Radio
                  id={inputId}

                  name="interface-type"
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  checked={selectedType === type}
                  onChange={() => onSelectType(type)}
                />
                <span className="block">
                  <span id={titleId} className="font-medium text-foreground">
                    {t(meta.titleKey)}
                  </span>
                  <span id={descriptionId} className="block text-xs text-muted-foreground">
                    {t(meta.descriptionKey)}
                  </span>
                </span>
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
  hasStoredS3SecretAccessKey?: boolean;
  hasStoredMeilisearchKey?: boolean;
  hasStoredMapApiKey?: boolean;
  deepLEntry?: InstanceInterfaceDeepL;
  ssfEntry?: Extract<InstanceInterface, { type: 'ssf_translation' }>;
  deepLChecking?: boolean;
  onCheckDeepL?: () => void;
  saveStatus: StudioSaveStatus;
  saveErrorMessage: string | null;
  onChange: (next: InstanceInterfaceDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onRetry?: () => void;
}>;

const MeilisearchFields = ({
  draft,
  hasStoredKey,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'meilisearch' }>;
  hasStoredKey: boolean;
  onChange: InterfaceFormProps['onChange'];
}) => {
  const update = (patch: Partial<typeof draft.config>) =>
    onChange({ ...draft, config: { ...draft.config, ...patch } });
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="meilisearch-origin">{t('interfaces.meilisearch.origin')}</Label>
        <Input
          id="meilisearch-origin"
          type="url"
          required
          value={draft.config.origin}
          onChange={(event) => update({ origin: event.currentTarget.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="meilisearch-environment">{t('interfaces.meilisearch.environment')}</Label>
        <select
          id="meilisearch-environment"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={draft.config.environment}
          onChange={(event) => {
            const selected = event.currentTarget.value;
            if (
              selected === 'production' ||
              selected === 'staging' ||
              selected === 'development' ||
              selected === 'test'
            )
              update({ environment: selected });
          }}
        >
          <option value="production">{t('interfaces.meilisearch.production')}</option>
          <option value="staging">{t('interfaces.meilisearch.staging')}</option>
          <option value="development">{t('interfaces.meilisearch.development')}</option>
          <option value="test">{t('interfaces.meilisearch.test')}</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="meilisearch-municipalities">
          {t('interfaces.meilisearch.municipalityIds')}
        </Label>
        <Input
          id="meilisearch-municipalities"
          required
          value={draft.config.municipalityIds}
          onChange={(event) => update({ municipalityIds: event.currentTarget.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="meilisearch-key">{t('interfaces.meilisearch.key')}</Label>
        <Input
          id="meilisearch-key"
          type="password"
          autoComplete="new-password"
          required={draft.enabled && !hasStoredKey}
          value={draft.config.apiKey}
          placeholder={hasStoredKey ? t('interfaces.meilisearch.keyStored') : undefined}
          onChange={(event) => update({ apiKey: event.currentTarget.value })}
        />
      </div>
    </>
  );
};

const deepLRequiresSave = (
  draft: InstanceInterfaceDraft,
  deepLEntry: InstanceInterfaceDeepL | undefined
): boolean =>
  draft.type === 'deepl' &&
  (!deepLEntry ||
    !!draft.config.apiKey ||
    draft.config.plan !== deepLEntry.config.plan ||
    draft.enabled !== deepLEntry.enabled);

const translationRequiresSave = (
  draft: InstanceInterfaceDraft,
  ssfEntry: InterfaceFormProps['ssfEntry'],
  deepLEntry: InterfaceFormProps['deepLEntry']
) =>
  draft.type === 'ssf_translation'
    ? !ssfEntry ||
      !!draft.config.apiKey ||
      draft.config.origin !== ssfEntry.config.origin ||
      draft.enabled !== ssfEntry.enabled
    : deepLRequiresSave(draft, deepLEntry);
const isTranslationVerified = (
  translationEntry: InterfaceFormProps['ssfEntry'] | InterfaceFormProps['deepLEntry']
) =>
  translationEntry?.status === 'connected' &&
  translationEntry.config.verifiedCredentialRevision === translationEntry.config.credentialRevision;

export const InterfaceForm = ({
  draft,
  hasStoredS3SecretAccessKey = false,
  hasStoredMeilisearchKey = false,
  hasStoredMapApiKey = false,
  deepLEntry,
  ssfEntry,
  deepLChecking = false,
  onCheckDeepL,
  saveStatus,
  saveErrorMessage,
  onChange,
  onCancel,
  onSubmit,
  onRetry = onSubmit,
}: InterfaceFormProps) => {
  const translationEntry = draft.type === 'ssf_translation' ? ssfEntry : deepLEntry;
  const isTranslation = draft.type === 'deepl' || draft.type === 'ssf_translation';
  const translationNeedsSave = translationRequiresSave(draft, ssfEntry, deepLEntry);
  const translationVerified = isTranslationVerified(translationEntry);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!deepLChecking) onSubmit();
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

      {draft.type === 'deepl' ? (
        <DeepLFields
          draft={draft}
          entry={deepLEntry}
          checking={deepLChecking}
          onChange={onChange}
        />
      ) : draft.type === 'ssf_translation' ? (
        <SsfFields
          draft={draft}
          entry={ssfEntry}
          checking={deepLChecking}
          verified={translationVerified}
          needsSave={translationNeedsSave}
          onChange={onChange}
        />
      ) : draft.type === 'meilisearch' ? (
        <MeilisearchFields
          draft={draft}
          hasStoredKey={hasStoredMeilisearchKey}
          onChange={onChange}
        />
      ) : draft.type === 'mainserver' ? (
        <MainserverFields draft={draft} onChange={onChange} />
      ) : draft.type === 's3' ? (
        <S3Fields
          draft={draft}
          hasStoredSecretAccessKey={hasStoredS3SecretAccessKey}
          onChange={onChange}
        />
      ) : draft.type === 'mapGeocoding' ? (
        <MapGeocodingFields
          draft={draft}
          hasStoredApiKey={hasStoredMapApiKey}
          onChange={onChange}
        />
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
          retryDisabled={saveStatus === 'saving' || deepLChecking}
          onRetry={onRetry}
        />
      ) : null}

      {isTranslation && translationNeedsSave && (
        <p className="text-sm text-muted-foreground">
          {t(
            draft.type === 'ssf_translation'
              ? 'interfaces.ssf.saveFirst'
              : 'interfaces.deepl.saveFirst'
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {isTranslation && (
          <TranslationCheck
            draft={draft}
            translationEntry={translationEntry}
            translationNeedsSave={translationNeedsSave}
            deepLChecking={deepLChecking}
            saveStatus={saveStatus}
            translationVerified={translationVerified}
            onCheckDeepL={onCheckDeepL}
          />
        )}
        <StudioSaveButton
          type="submit"
          status={saveStatus}
          disabled={deepLChecking}
          labels={{
            idle: t('interfaces.actions.save'),
            saving: t('interfaces.actions.saving'),
            saved: t('interfaces.actions.saved'),
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={saveStatus === 'saving' || deepLChecking}
          onClick={onCancel}
        >
          {t('interfaces.edit.cancel')}
        </Button>
      </div>
    </form>
  );
};
