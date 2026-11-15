/** Staff locale selection and staff-owned texts. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioSection } from '@sva/studio-ui-react';
import { SsfV2Field as Field, updateSsfV2Field } from './admin.content-v2-field-control.js';
import type { SsfRuntimeEditorProps as Props } from './admin.content-v2-runtime-fields.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';
import { catalogLanguages, primaryLanguage } from './admin.content-v2-fields.js';
const catalogLocale = (locale: string, catalog: SsfSupportedLanguagesCatalog) =>
  catalog.languages[locale] ? locale : (locale.split(/[-_]/, 1)[0] ?? locale);

const StaffLocaleField = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const guestLanguages = new Set(
    props.value.guestLanguages.map(({ locale }) => primaryLanguage(locale))
  );
  const availableStaffLanguages = props.supportedLanguages
    ? catalogLanguages(props.supportedLanguages).filter(
        ([locale]) => !guestLanguages.has(primaryLanguage(locale))
      )
    : [];
  return (
    <StudioField id="ssf-v2-staff-locale" label={pt('v2.locale')}>
      <Select
        id="ssf-v2-staff-locale"
        disabled={props.disabled || !props.supportedLanguages}
        value={
          props.supportedLanguages
            ? catalogLocale(props.value.staff.locale, props.supportedLanguages)
            : props.value.staff.locale
        }
        onChange={(event) =>
          props.onChange(
            updateSsfV2Field(props.value, ['staff', 'locale'], event.currentTarget.value)
          )
        }
      >
        {props.supportedLanguages &&
        !props.supportedLanguages.languages[
          catalogLocale(props.value.staff.locale, props.supportedLanguages)
        ] ? (
          <option value={catalogLocale(props.value.staff.locale, props.supportedLanguages)}>
            {pt('v2.savedLanguageUnavailable')}
          </option>
        ) : null}
        {props.supportedLanguages ? (
          availableStaffLanguages.map(([locale, language]) => (
            <option key={locale} value={locale}>
              {language.name} ({language.native}) · {locale}
            </option>
          ))
        ) : (
          <option value={props.value.staff.locale}>{props.value.staff.locale}</option>
        )}
      </Select>
    </StudioField>
  );
};

export const StaffFields = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  return (
    <StudioSection title={pt('v2.staff')}>
      {props.part !== 'texts' ? (
        <StaffLocaleField {...props} />
      ) : (
        <p>
          {pt('v2.locale')}: {props.value.staff.locale}
        </p>
      )}
      {props.part !== 'metadata' ? (
        <>
          <Field
            {...props}
            path={['staff', 'dashboard', 'headline']}
            labelKey="v2.dashboardHeadline"
          />
          <Field
            {...props}
            path={['staff', 'dashboard', 'explanationHtml']}
            labelKey="v2.dashboardExplanation"
            kind="html"
          />
          <Field
            {...props}
            path={['staff', 'dashboard', 'callToAction']}
            labelKey="v2.callToAction"
          />
          {(['headline', 'green', 'yellow', 'red'] as const).map((key) => (
            <Field
              key={key}
              {...props}
              path={['staff', 'dashboard', 'load', key]}
              labelKey={`v2.load.${key}`}
            />
          ))}
          <Field
            {...props}
            path={['staff', 'newConversation', 'headline']}
            labelKey="v2.newConversationHeadline"
          />
          <Field
            {...props}
            path={['staff', 'newConversation', 'descriptionHtml']}
            labelKey="v2.newConversationDescription"
            kind="html"
          />
        </>
      ) : null}
    </StudioSection>
  );
};
