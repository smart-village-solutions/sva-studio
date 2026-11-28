import { Button, Checkbox, type StudioSaveStatus } from '@sva/studio-ui-react';
import { Input } from '../../components/ui/input';
import { getActiveLocale, t } from '../../i18n';
import type { InstanceInterface, InstanceInterfaceDraft } from '../../lib/instance-interfaces';

export const SsfFields = ({
  draft,
  entry,
  checking,
  verified,
  needsSave,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'ssf_translation' }>;
  entry?: Extract<InstanceInterface, { type: 'ssf_translation' }>;
  checking: boolean;
  verified: boolean;
  needsSave: boolean;
  onChange: (draft: InstanceInterfaceDraft) => void;
}) => {
  const needsKey = entry?.apiKeyConfigured
    ? draft.config.origin.trim().replace(/\/$/u, '') !== entry.config.origin
    : draft.enabled;
  const names = new Intl.DisplayNames([getActiveLocale()], { type: 'language' });
  return (
    <fieldset className="grid gap-3" disabled={checking}>
      <legend className="text-base font-semibold">
        {t('interfaces.types.ssf_translation.label')}
      </legend>
      <label className="grid gap-2" htmlFor="ssf-origin">
        {t('interfaces.ssf.origin')}
        <Input
          id="ssf-origin"
          type="url"
          required
          value={draft.config.origin}
          onChange={(event) =>
            onChange({
              ...draft,
              config: { ...draft.config, origin: event.currentTarget.value },
            })
          }
        />
      </label>
      <label className="grid gap-2" htmlFor="ssf-api-key">
        {t('interfaces.deepl.apiKey')}
        <Input
          id="ssf-api-key"
          type="password"
          autoComplete="new-password"
          maxLength={4096}
          required={needsKey}
          value={draft.config.apiKey}
          onChange={(event) =>
            onChange({
              ...draft,
              config: { ...draft.config, apiKey: event.currentTarget.value },
            })
          }
        />
      </label>
      {entry?.apiKeyConfigured && (
        <p className="text-sm text-muted-foreground">{t('interfaces.deepl.keyStored')}</p>
      )}
      <fieldset className="grid gap-2" disabled={!verified || needsSave}>
        <legend>{t('interfaces.deepl.languages')}</legend>
        {!verified && <p role="status">{t('interfaces.deepl.checkFirst')}</p>}
        {[
          ...new Set([
            ...(entry?.config.availableLanguages ?? []),
            ...draft.config.selectedLocales,
          ]),
        ].map((locale) => (
          <label className="flex items-center gap-2" key={locale}>
            <Checkbox
              checked={draft.config.selectedLocales.includes(locale)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  config: {
                    ...draft.config,
                    selectedLocales: event.currentTarget.checked
                      ? [...draft.config.selectedLocales, locale]
                      : draft.config.selectedLocales.filter((selected) => selected !== locale),
                  },
                })
              }
            />
            {names.of(locale)}
          </label>
        ))}
      </fieldset>
    </fieldset>
  );
};

export const TranslationCheck = ({
  draft,
  translationEntry,
  translationNeedsSave,
  deepLChecking,
  saveStatus,
  translationVerified,
  onCheckDeepL,
}: {
  draft: InstanceInterfaceDraft;
  translationEntry?: InstanceInterface;
  translationNeedsSave: boolean;
  deepLChecking: boolean;
  saveStatus: StudioSaveStatus;
  translationVerified: boolean;
  onCheckDeepL?: () => void;
}) => (
  <>
    <Button
      type="button"
      variant="secondary"
      disabled={
        translationNeedsSave ||
        deepLChecking ||
        saveStatus === 'saving' ||
        !translationEntry?.enabled
      }
      onClick={onCheckDeepL}
    >
      {t(
        deepLChecking
          ? draft.type === 'ssf_translation'
            ? 'interfaces.ssf.checking'
            : 'interfaces.deepl.checking'
          : translationVerified
            ? 'interfaces.deepl.recheck'
            : 'interfaces.deepl.check'
      )}
    </Button>
    {translationVerified && !translationNeedsSave && (
      <span role="status" className="text-sm text-muted-foreground">
        {t('interfaces.deepl.verified')}
      </span>
    )}
  </>
);
