/** Guest metadata, content and feedback editor projections. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField, StudioSection } from '@sva/studio-ui-react';
import { useEffect, useRef, useState } from 'react';
import {
  SsfV2Field as Field,
  SsfLanguageVersionSelect,
  updateSsfV2Field,
} from './admin.content-v2-field-control.js';
import { FeedbackFields } from './admin.content-v2-fields.js';
import { AddLanguage, LanguageToggle } from './admin.content-v2-guest-membership.js';
import type {
  SsfGuestLanguage as Language,
  SsfRuntimeEditorProps as Props,
} from './admin.content-v2-runtime-fields.js';
type GuestEntryProps = { props: Props; language: Language; index: number };
const GuestIconFields = ({ props, language, index }: GuestEntryProps) => {
  const pt = usePluginTranslation('ssf');
  return (
    <>
      <StudioField id={`ssf-v2-guest-${index}-icon-url`} label={pt('v2.iconUrl')}>
        <Input
          id={`ssf-v2-guest-${index}-icon-url`}
          type="url"
          disabled={props.disabled}
          value={language.icon?.url ?? ''}
          onChange={(event) => {
            const url = event.currentTarget.value;
            props.onChange(
              updateSsfV2Field(
                props.value,
                ['guestLanguages', index, 'icon'],
                url === '' ? null : { url, alternativeText: language.icon?.alternativeText ?? '' }
              )
            );
          }}
        />
      </StudioField>
      {language.icon ? (
        <Field
          {...props}
          path={['guestLanguages', index, 'icon', 'alternativeText']}
          labelKey="v2.alternativeText"
        />
      ) : null}
      {props.inherited ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {pt(
              JSON.stringify(language.icon ?? null) ===
                JSON.stringify(
                  props.inherited.guestLanguages.find((entry) => entry.locale === language.locale)
                    ?.icon ?? null
                )
                ? 'v2.inherited'
                : 'v2.overridden'
            )}
          </span>
          <Button
            type="button"
            variant="tertiary"
            disabled={props.disabled}
            onClick={() =>
              props.onChange(
                updateSsfV2Field(
                  props.value,
                  ['guestLanguages', index, 'icon'],
                  props.inherited?.guestLanguages.find((entry) => entry.locale === language.locale)
                    ?.icon
                ),
                ['guestLanguages', index, 'icon']
              )
            }
          >
            {pt('fields.inherit')}
          </Button>
        </div>
      ) : null}
    </>
  );
};

const LanguageTab = ({
  props,
  language,
  index,
}: {
  props: Props;
  language: Language;
  index: number;
}) => {
  const pt = usePluginTranslation('ssf');
  return (
    <div className="space-y-5">
      {props.part === 'metadata' && !props.inherited && props.value.guestLanguages.length > 1 ? (
        <Button
          type="button"
          variant="secondary"
          disabled={props.disabled || !props.supportedLanguages}
          onClick={() =>
            props.onChange({
              ...props.value,
              guestLanguages: props.value.guestLanguages.filter(
                (entry) => entry.locale !== language.locale
              ),
            })
          }
        >
          {pt('v2.removeLanguage')}
        </Button>
      ) : null}
      {props.part === 'metadata' ? (
        <>
          <Field
            {...props}
            path={['guestLanguages', index, 'nativeName']}
            labelKey="v2.nativeName"
          />
          <Field {...props} path={['guestLanguages', index, 'staffName']} labelKey="v2.staffName" />
          <GuestIconFields props={props} language={language} index={index} />
          {!props.inherited &&
          props.existingGuestLocales &&
          !props.existingGuestLocales.includes(language.locale) ? (
            <StudioSection title={pt('administration.newLanguageContent')}>
              <p>{pt('administration.newLanguageContentHint')}</p>
              <Field
                {...props}
                path={['guestLanguages', index, 'guest', 'explanationHtml']}
                labelKey="v2.guestExplanation"
                kind="html"
              />
              <FeedbackFields {...props} path={['guestLanguages', index, 'feedback']} />
            </StudioSection>
          ) : null}
        </>
      ) : null}
      {props.part === 'texts' ? (
        <Field
          {...props}
          path={['guestLanguages', index, 'guest', 'explanationHtml']}
          labelKey="v2.guestExplanation"
          kind="html"
        />
      ) : null}
      {props.part === 'feedback' ? (
        <FeedbackFields {...props} path={['guestLanguages', index, 'feedback']} />
      ) : null}
    </div>
  );
};

export const GuestLanguages = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const hiddenLanguages = useRef(new Map<string, Language>());
  const [selected, setSelected] = useState(props.value.guestLanguages[0]?.locale ?? '');
  const lastErrors = useRef(props.errors);
  const active = props.value.guestLanguages.some((entry) => entry.locale === selected)
    ? selected
    : (props.value.guestLanguages[0]?.locale ?? '');
  const index = props.value.guestLanguages.findIndex((entry) => entry.locale === active);
  useEffect(() => {
    // A validation round may reveal a language once; later edits respect manual selection.
    if (lastErrors.current === props.errors) return;
    lastErrors.current = props.errors;
    const path = Object.keys(props.errors ?? {}).find((key) => key.startsWith('guestLanguages.'));
    const language = path ? props.value.guestLanguages[Number(path.split('.')[1])] : undefined;
    if (language) setSelected(language.locale);
  }, [props.errors, props.value.guestLanguages]);
  return (
    <StudioSection title={pt('v2.guestLanguages')}>
      {props.part === 'metadata' ? (
        props.inherited ? (
          props.inherited.guestLanguages.map((language) => (
            <LanguageToggle
              key={language.locale}
              props={props}
              language={language}
              hiddenLanguages={hiddenLanguages}
            />
          ))
        ) : (
          <AddLanguage {...props} onAdded={setSelected} />
        )
      ) : null}
      {index >= 0 ? (
        <>
          <SsfLanguageVersionSelect
            entries={props.value.guestLanguages.map((language) => ({
              id: language.locale,
              locale: language.locale,
              name: language.nativeName,
            }))}
            selected={active}
            onSelect={setSelected}
            catalog={props.supportedLanguages}
          />
          <LanguageTab
            key={active}
            props={props}
            language={props.value.guestLanguages[index]!}
            index={index}
          />
        </>
      ) : null}
    </StudioSection>
  );
};
