/** Guest-language creation and activation preserve existing membership rules. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Select, StudioField } from '@sva/studio-ui-react';
import { useState, type RefObject } from 'react';
import { blankFeedback } from './admin.content-v2-fields.js';
import type {
  SsfGuestLanguage as Language,
  SsfRuntimeEditorProps as Props,
} from './admin.content-v2-runtime-fields.js';
import { catalogLanguages, primaryLanguage } from './admin.content-v2-fields.js';
export const AddLanguage = (props: Props & { onAdded: (locale: string) => void }) => {
  const pt = usePluginTranslation('ssf');
  const catalog = props.supportedLanguages;
  const [locale, setLocale] = useState('');
  const staffLanguage = primaryLanguage(props.value.staff.locale);
  const available = catalog
    ? catalogLanguages(catalog).filter(
        ([code]) =>
          primaryLanguage(code) !== staffLanguage &&
          !props.value.guestLanguages.some((language) => language.locale === code)
      )
    : [];
  const add = () => {
    if (!catalog) return;
    const language = catalog.languages[locale];
    if (!language) return;
    props.onChange({
      ...props.value,
      guestLanguages: [
        ...props.value.guestLanguages,
        {
          locale,
          nativeName: language.native,
          staffName: language.name,
          icon: null,
          guest: { explanationHtml: '', storageQuestionHtml: null },
          feedback: blankFeedback(),
        },
      ],
    });
    props.onAdded(locale);
    setLocale('');
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <StudioField id="ssf-v2-new-locale" label={pt('v2.newLanguage')}>
        <Select
          id="ssf-v2-new-locale"
          value={locale}
          disabled={props.disabled || !catalog}
          onChange={(event) => setLocale(event.currentTarget.value)}
        >
          <option value="">{pt('v2.chooseLanguage')}</option>
          {available.map(([code, language]) => (
            <option key={code} value={code}>
              {language.name} ({language.native}) · {code}
            </option>
          ))}
        </Select>
      </StudioField>
      <Button
        type="button"
        variant="secondary"
        disabled={
          props.disabled ||
          !catalog ||
          !locale ||
          !catalog.languages[locale] ||
          props.value.guestLanguages.length >= 30
        }
        onClick={add}
      >
        {pt('v2.addLanguage')}
      </Button>
    </div>
  );
};

export const LanguageToggle = ({
  props,
  language,
  hiddenLanguages,
}: {
  props: Props;
  language: Language;
  hiddenLanguages: RefObject<Map<string, Language>>;
}) => {
  const inherited = props.inherited;
  if (!inherited) return null;
  const active = props.value.guestLanguages.some((entry) => entry.locale === language.locale);
  const toggle = (enabled: boolean) => {
    if (!enabled) {
      const current = props.value.guestLanguages.find((entry) => entry.locale === language.locale);
      if (current) hiddenLanguages.current.set(language.locale, current);
    }
    props.onChange({
      ...props.value,
      guestLanguages: enabled
        ? inherited.guestLanguages
            .filter(
              (entry) =>
                entry.locale === language.locale ||
                props.value.guestLanguages.some((current) => current.locale === entry.locale)
            )
            .map(
              (entry) =>
                props.value.guestLanguages.find((current) => current.locale === entry.locale) ??
                hiddenLanguages.current.get(entry.locale) ??
                entry
            )
        : props.value.guestLanguages.filter((entry) => entry.locale !== language.locale),
    });
  };
  return (
    <label className="flex items-center gap-2">
      <Checkbox
        checked={active}
        disabled={
          props.disabled ||
          !props.supportedLanguages ||
          (active && props.value.guestLanguages.length === 1)
        }
        onChange={(event) => toggle(event.currentTarget.checked)}
      />
      <span>
        {language.nativeName} ({language.locale})
      </span>
    </label>
  );
};
