import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Checkbox,
  RichTextHtmlEditor,
  Select,
  StudioField,
  StudioSection,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';
import { useMemo } from 'react';

import type {
  SsfSystemConfigurationInput,
  SsfTenantConfigurationInput,
} from './admin-contracts.js';
import { createSsfEditorLabels } from './admin.editor-labels.js';

type Configuration = SsfSystemConfigurationInput | SsfTenantConfigurationInput;
type Locale = Configuration['locales'][number];
type LocaleField =
  | 'authenticatedHomeExplanationHtml'
  | 'guestExplanationHtml'
  | 'conversationContentStorageQuestionHtml';
const localeFields: readonly [LocaleField, string][] = [
  ['authenticatedHomeExplanationHtml', 'fields.authenticated'],
  ['guestExplanationHtml', 'fields.guest'],
  ['conversationContentStorageQuestionHtml', 'fields.storageQuestion'],
];

const LocaleRichTextField = ({
  locale,
  field,
  labelKey,
  inherited,
  disabled,
  onChange,
}: Readonly<{
  locale: Locale;
  field: LocaleField;
  labelKey: string;
  inherited: string;
  disabled: boolean;
  onChange: (value: string | null) => void;
}>) => {
  const pt = usePluginTranslation('ssf');
  const richText = useMemo(() => createSsfEditorLabels(pt), [pt]);
  const current = locale[field];
  const isTenant = 'enabled' in locale;
  const id = `ssf-${locale.locale}-${field}`;
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <label id={`${id}-label`} className="text-sm font-medium">
          {pt(labelKey)}
        </label>
        {isTenant ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              disabled={disabled}
              checked={current === null}
              onChange={(event) => onChange(event.currentTarget.checked ? null : inherited)}
            />
            {pt('fields.inherit')}
          </label>
        ) : null}
      </div>
      <RichTextHtmlEditor
        id={id}
        labelId={`${id}-label`}
        value={current ?? inherited}
        disabled={disabled || current === null}
        onChange={onChange}
        {...richText}
      />
    </div>
  );
};

const LocaleConfiguration = ({
  locale,
  systemLocale,
  disabled,
  onChange,
}: Readonly<{
  locale: Locale;
  systemLocale?: SsfSystemConfigurationInput['locales'][number];
  disabled: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}>) => {
  const pt = usePluginTranslation('ssf');
  const isTenant = 'enabled' in locale;
  const active = isTenant ? (locale.enabled ?? systemLocale?.available ?? true) : locale.available;
  return (
    <StudioSection title={locale.locale}>
      <StudioField
        id={`ssf-${locale.locale}-active`}
        label={pt(isTenant ? 'fields.enabled' : 'fields.available')}
      >
        <div className="flex items-center gap-4">
          <Checkbox
            id={`ssf-${locale.locale}-active`}
            disabled={disabled}
            checked={active}
            onChange={(event) =>
              onChange({ [isTenant ? 'enabled' : 'available']: event.currentTarget.checked })
            }
          />
          {isTenant ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                disabled={disabled}
                checked={locale.enabled === null}
                onChange={(event) =>
                  onChange({ enabled: event.currentTarget.checked ? null : active })
                }
              />
              {pt('fields.inherit')}
            </label>
          ) : null}
        </div>
      </StudioField>
      <div className="space-y-6">
        {localeFields.map(([field, labelKey]) => (
          <LocaleRichTextField
            key={field}
            locale={locale}
            field={field}
            labelKey={labelKey}
            inherited={systemLocale?.[field] ?? ''}
            disabled={disabled}
            onChange={(value) => onChange({ [field]: value })}
          />
        ))}
      </div>
    </StudioSection>
  );
};

const ConfigurationSelects = ({
  value,
  tenantSystem,
  disabled,
  onChange,
}: Readonly<{
  value: Configuration;
  tenantSystem?: SsfSystemConfigurationInput;
  disabled: boolean;
  onChange: (value: Configuration) => void;
}>) => {
  const pt = usePluginTranslation('ssf');
  const isTenant = tenantSystem !== undefined;
  return (
    <StudioSection title={pt('fields.languages')}>
      <div className="grid gap-4 md:grid-cols-2">
        <StudioField id="ssf-default-locale" label={pt('fields.defaultLocale')}>
          <Select
            id="ssf-default-locale"
            value={value.defaultLocale ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, defaultLocale: event.target.value || null } as Configuration)
            }
          >
            {isTenant ? <option value="">{pt('fields.inherit')}</option> : null}
            {value.locales.map(({ locale }) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </Select>
        </StudioField>
        <StudioField id="ssf-storage-mode" label={pt('fields.storageMode')}>
          <Select
            id="ssf-storage-mode"
            value={value.conversationContentStorageMode ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                conversationContentStorageMode: event.target.value || null,
              } as Configuration)
            }
          >
            {isTenant ? <option value="">{pt('fields.inherit')}</option> : null}
            <option value="ask">{pt('fields.ask')}</option>
            <option value="disabled">{pt('fields.disabled')}</option>
          </Select>
        </StudioField>
      </div>
      {tenantSystem ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            {pt('fields.systemDefaultLocale')}: {tenantSystem.defaultLocale}
          </p>
          <p>
            {pt('fields.systemStorageMode')}:{' '}
            {pt(`fields.${tenantSystem.conversationContentStorageMode}`)}
          </p>
        </div>
      ) : null}
    </StudioSection>
  );
};

export const ConfigurationFields = ({
  value,
  onChange,
  disabled,
  tenantSystem,
}: Readonly<{
  value: Configuration;
  onChange: (value: Configuration) => void;
  disabled: boolean;
  tenantSystem?: SsfSystemConfigurationInput;
}>) => {
  const pt = usePluginTranslation('ssf');
  const updateLocale = (index: number, patch: Record<string, unknown>) =>
    onChange({
      ...value,
      locales: value.locales.map((entry, itemIndex) =>
        itemIndex === index ? { ...entry, ...patch } : entry
      ),
    } as Configuration);
  return (
    <div className="space-y-5">
      <ConfigurationSelects
        value={value}
        tenantSystem={tenantSystem}
        disabled={disabled}
        onChange={onChange}
      />
      <Tabs defaultValue={value.defaultLocale ?? tenantSystem?.defaultLocale ?? 'de-DE'}>
        <TabsList aria-label={pt('fields.languages')}>
          {value.locales.map(({ locale }) => (
            <TabsTrigger key={locale} value={locale}>
              {locale}
            </TabsTrigger>
          ))}
        </TabsList>
        {value.locales.map((locale, index) => (
          <TabsContent key={locale.locale} value={locale.locale} className="space-y-5">
            <LocaleConfiguration
              locale={locale}
              systemLocale={tenantSystem?.locales.find((entry) => entry.locale === locale.locale)}
              disabled={disabled}
              onChange={(patch) => updateLocale(index, patch)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
