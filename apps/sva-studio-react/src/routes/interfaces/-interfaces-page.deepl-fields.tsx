import {
  APP_TRANSLATION_LOCALES,
  appTranslationLanguage,
  deepLTargetCode,
  type DeepLLanguage,
} from '@sva/plugin-sdk/app-translations';
import { Checkbox, Input, Select } from '@sva/studio-ui-react';
import { getActiveLocale, t } from '../../i18n';
import type { InstanceInterfaceDraft, InstanceInterfaceDeepL } from '../../lib/instance-interfaces';
const languageTargets = (available: readonly DeepLLanguage[]) => {
  const names = new Intl.DisplayNames([getActiveLocale()], { type: 'language' });
  const groups = new Map<string, DeepLLanguage[]>();
  const languageName = (code: string) => {
    const translated = names.of(code);
    if (translated && translated !== code) return translated;
    const languages = groups.get(appTranslationLanguage(code));
    return (
      languages?.find((language) => language.code === code)?.name ?? languages?.[0]?.name ?? code
    );
  };
  for (const language of available) {
    const base = appTranslationLanguage(language.code);
    if (base === 'de') continue;
    groups.set(base, [...(groups.get(base) ?? []), language]);
  }
  const targets = [...groups].sort(([left], [right]) =>
    languageName(left).localeCompare(languageName(right), getActiveLocale())
  );
  return { groups, languageName, targets };
};

export const DeepLFields = ({
  draft,
  entry,
  checking,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'deepl' }>;
  entry?: InstanceInterfaceDeepL;
  checking: boolean;
  onChange: (draft: InstanceInterfaceDraft) => void;
}) => {
  const config = draft.config;
  const patch = (value: Partial<typeof config>) =>
    onChange({ ...draft, config: { ...config, ...value } });
  const available = entry?.config.availableLanguages ?? [];
  const verified =
    entry?.status === 'connected' &&
    entry.config.verifiedCredentialRevision === entry.config.credentialRevision;
  const { groups, languageName, targets } = languageTargets(available);
  const choose = (base: string, code?: string) => {
    const selectedLocales = config.selectedLocales.filter(
      (locale) => appTranslationLanguage(locale) !== base
    );
    // Existing English catalogs use `en`; retain their storage identity and variant setting.
    const legacyEnglish = code === 'en-GB' || code === 'en-US';
    patch({
      selectedLocales: code ? [...selectedLocales, legacyEnglish ? 'en' : code] : selectedLocales,
      ...(legacyEnglish ? { englishVariant: code } : {}),
    });
  };
  const selectionDisabled = !verified || !!config.apiKey || config.plan !== entry?.config.plan;
  return (
    <fieldset className="grid gap-4" disabled={checking}>
      <legend className="text-base font-semibold">{t('interfaces.types.deepl.label')}</legend>
      <label className="grid gap-2" htmlFor="deepl-plan">
        {t('interfaces.deepl.plan')}
        <Select
          id="deepl-plan"
          value={config.plan}
          onChange={(event) => patch({ plan: event.target.value as 'free' | 'pro' })}
        >
          <option value="pro">{t('interfaces.deepl.pro')}</option>
          <option value="free">{t('interfaces.deepl.free')}</option>
        </Select>
      </label>
      <label className="grid gap-2" htmlFor="deepl-api-key">
        {t('interfaces.deepl.apiKey')}
        <Input
          id="deepl-api-key"
          type="password"
          autoComplete="new-password"
          value={config.apiKey}
          maxLength={4096}
          required={draft.enabled && !entry?.apiKeyConfigured}
          onChange={(event) => patch({ apiKey: event.target.value })}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        {t(entry?.apiKeyConfigured ? 'interfaces.deepl.keyStored' : 'interfaces.deepl.keyRequired')}
      </p>
      <div className="space-y-3">
        <h3 className="font-medium">{t('interfaces.deepl.languages')}</h3>
        <p className="text-sm text-muted-foreground">{t('interfaces.deepl.languagesHelp')}</p>
        {!available.length && <p role="status">{t('interfaces.deepl.checkFirst')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {targets.map(([base, languages]) => {
            const variants = languages
              .filter(
                (language) =>
                  base !== 'en' ||
                  language.code !== 'en' ||
                  !languages.some((item) => item.code === 'en-GB' || item.code === 'en-US')
              )
              .sort((left, right) =>
                languageName(left.code).localeCompare(languageName(right.code), getActiveLocale())
              );
            const selected = config.selectedLocales.find(
              (locale) => appTranslationLanguage(locale) === base
            );
            const selectedCode = selected
              ? deepLTargetCode(selected, config.englishVariant, available)
              : undefined;
            const preferred = APP_TRANSLATION_LOCALES.map((locale) =>
              deepLTargetCode(locale, config.englishVariant, available)
            ).find((code) => variants.some((language) => language.code === code));
            return (
              <div
                key={base}
                className="flex min-h-14 items-center gap-3 rounded-md border px-3 py-2"
              >
                <label className="flex min-w-0 items-center gap-3">
                  <Checkbox
                    className="shrink-0"
                    checked={!!selected}
                    disabled={selectionDisabled}
                    onChange={(event) =>
                      choose(
                        base,
                        event.target.checked ? (preferred ?? variants[0]?.code) : undefined
                      )
                    }
                  />
                  <span className="truncate" title={languageName(base)}>
                    {languageName(base)}
                  </span>
                </label>
                {selected &&
                  (variants.length > 1 ||
                    !variants.some((language) => language.code === selectedCode)) && (
                    <label
                      className="ml-auto w-48 min-w-0 max-w-[60%]"
                      htmlFor={`deepl-variant-${base}`}
                    >
                      <span className="sr-only">
                        {t('interfaces.deepl.variant', { language: languageName(base) })}
                      </span>
                      <Select
                        id={`deepl-variant-${base}`}
                        className="h-8 text-sm"
                        value={selectedCode}
                        disabled={selectionDisabled}
                        onChange={(event) => choose(base, event.target.value)}
                      >
                        {!variants.some((language) => language.code === selectedCode) && (
                          <option value={selectedCode} disabled>
                            {t('interfaces.deepl.targetUnavailable')}
                          </option>
                        )}
                        {variants.map((language) => (
                          <option key={language.code} value={language.code}>
                            {languageName(language.code)}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
              </div>
            );
          })}
        </div>
        {config.selectedLocales
          .filter((locale) => !groups.has(appTranslationLanguage(locale)))
          .map((locale) => (
            <label key={locale} className="flex items-center gap-3 text-sm">
              <Checkbox checked onChange={() => choose(appTranslationLanguage(locale))} />
              {languageName(locale)} — {t('interfaces.deepl.targetUnavailable')}
            </label>
          ))}
      </div>
    </fieldset>
  );
};
