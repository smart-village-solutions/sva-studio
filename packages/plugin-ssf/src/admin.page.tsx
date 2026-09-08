import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  RichTextHtmlEditor,
  Select,
  StudioErrorState,
  StudioField,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioSection,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type {
  SsfSystemConfigurationInput,
  SsfTenantConfigurationInput,
} from './admin-contracts.js';
import {
  readSsfSystemConfiguration,
  readSsfTenantConfiguration,
  writeSsfSystemConfiguration,
  writeSsfTenantConfiguration,
} from './admin-api.js';

const editorLabels = (pt: ReturnType<typeof usePluginTranslation>) => ({
  blockTypeOptions: [
    { value: 'paragraph' as const, label: pt('richText.paragraph') },
    { value: 'heading-2' as const, label: pt('richText.heading2') },
    { value: 'heading-3' as const, label: pt('richText.heading3') },
    { value: 'blockquote' as const, label: pt('richText.quote') },
  ],
  toolbarLabels: {
    mode: pt('richText.mode'),
    visualMode: pt('richText.visual'),
    htmlMode: pt('richText.html'),
    blockType: pt('richText.block'),
    bulletList: pt('richText.bullets'),
    orderedList: pt('richText.ordered'),
    bold: pt('richText.bold'),
    italic: pt('richText.italic'),
    underline: pt('richText.underline'),
    clearFormatting: pt('richText.clear'),
    undo: pt('richText.undo'),
    redo: pt('richText.redo'),
    link: pt('richText.link'),
    linkPrompt: pt('richText.linkPrompt'),
  },
});

type LocaleField =
  | 'authenticatedHomeExplanationHtml'
  | 'guestExplanationHtml'
  | 'conversationContentStorageQuestionHtml';
const localeFields: readonly [LocaleField, string][] = [
  ['authenticatedHomeExplanationHtml', 'fields.authenticated'],
  ['guestExplanationHtml', 'fields.guest'],
  ['conversationContentStorageQuestionHtml', 'fields.storageQuestion'],
];

const ConfigurationFields = ({
  value,
  onChange,
  disabled,
  tenantSystem,
}: Readonly<{
  value: SsfSystemConfigurationInput | SsfTenantConfigurationInput;
  onChange: (value: SsfSystemConfigurationInput | SsfTenantConfigurationInput) => void;
  disabled: boolean;
  tenantSystem?: SsfSystemConfigurationInput;
}>) => {
  const pt = usePluginTranslation('ssf');
  const richText = useMemo(() => editorLabels(pt), [pt]);
  const isTenant = tenantSystem !== undefined;
  const effectiveDefault = value.defaultLocale ?? tenantSystem?.defaultLocale ?? 'de-DE';
  const updateLocale = (index: number, patch: Record<string, unknown>) =>
    onChange({
      ...value,
      locales: value.locales.map((entry, itemIndex) =>
        itemIndex === index ? { ...entry, ...patch } : entry
      ),
    } as typeof value);

  return (
    <div className="space-y-5">
      <StudioSection title={pt('fields.languages')}>
        <div className="grid gap-4 md:grid-cols-2">
          <StudioField id="ssf-default-locale" label={pt('fields.defaultLocale')}>
            <Select
              id="ssf-default-locale"
              value={value.defaultLocale ?? ''}
              disabled={disabled}
              onChange={(event) =>
                (onChange as (next: typeof value) => void)({
                  ...value,
                  defaultLocale: event.target.value || null,
                } as typeof value)
              }
            >
              {isTenant ? <option value="">{pt('fields.inherit')}</option> : null}
              {value.locales.map((entry) => (
                <option key={entry.locale} value={entry.locale}>
                  {entry.locale}
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
                (onChange as (next: typeof value) => void)({
                  ...value,
                  conversationContentStorageMode: event.target.value || null,
                } as typeof value)
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

      <Tabs defaultValue={effectiveDefault}>
        <TabsList aria-label={pt('fields.languages')}>
          {value.locales.map((locale) => (
            <TabsTrigger key={locale.locale} value={locale.locale}>
              {locale.locale}
            </TabsTrigger>
          ))}
        </TabsList>
        {value.locales.map((locale, index) => (
          <TabsContent key={locale.locale} value={locale.locale} className="space-y-5">
            <StudioSection title={locale.locale}>
              <StudioField
                id={`ssf-${locale.locale}-active`}
                label={pt(isTenant ? 'fields.enabled' : 'fields.available')}
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    id={`ssf-${locale.locale}-active`}
                    disabled={disabled}
                    checked={
                      (isTenant
                        ? 'enabled' in locale
                          ? locale.enabled
                          : null
                        : 'available' in locale
                          ? locale.available
                          : false) ??
                      tenantSystem?.locales.find((entry) => entry.locale === locale.locale)
                        ?.available ??
                      true
                    }
                    onChange={(event) =>
                      updateLocale(index, {
                        [isTenant ? 'enabled' : 'available']: event.currentTarget.checked,
                      })
                    }
                  />
                  {isTenant && 'enabled' in locale ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        disabled={disabled}
                        checked={locale.enabled === null}
                        onChange={(event) =>
                          updateLocale(index, {
                            enabled: event.currentTarget.checked
                              ? null
                              : (tenantSystem.locales.find(
                                  (entry) => entry.locale === locale.locale
                                )?.available ?? true),
                          })
                        }
                      />
                      {pt('fields.inherit')}
                    </label>
                  ) : null}
                </div>
              </StudioField>
              <div className="space-y-6">
                {localeFields.map(([field, labelKey]) => {
                  const current = locale[field];
                  const inherited =
                    tenantSystem?.locales.find((entry) => entry.locale === locale.locale)?.[
                      field
                    ] ?? '';
                  return (
                    <div
                      key={field}
                      className="space-y-2 rounded-lg border border-border/70 bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label
                          id={`ssf-${locale.locale}-${field}-label`}
                          className="text-sm font-medium"
                        >
                          {pt(labelKey)}
                        </label>
                        {isTenant ? (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              disabled={disabled}
                              checked={current === null}
                              onChange={(event) =>
                                updateLocale(index, {
                                  [field]: event.currentTarget.checked ? null : inherited,
                                })
                              }
                            />
                            {pt('fields.inherit')}
                          </label>
                        ) : null}
                      </div>
                      <RichTextHtmlEditor
                        id={`ssf-${locale.locale}-${field}`}
                        labelId={`ssf-${locale.locale}-${field}-label`}
                        value={current ?? inherited}
                        disabled={disabled || current === null}
                        onChange={(next) => updateLocale(index, { [field]: next })}
                        {...richText}
                      />
                    </div>
                  );
                })}
              </div>
            </StudioSection>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export const SsfSystemConfigurationPage = () => {
  const pt = usePluginTranslation('ssf');
  const [saved, setSaved] = useState<SsfSystemConfigurationInput | null>(null);
  const [draft, setDraft] = useState<SsfSystemConfigurationInput | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'saving' | 'saved'>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await readSsfSystemConfiguration();
      setSaved(next);
      setDraft(next);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (state === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (state === 'error' || !draft)
    return (
      <StudioErrorState>
        <button type="button" onClick={() => void load()}>
          {pt('status.loadError')}
        </button>
      </StudioErrorState>
    );
  return (
    <StudioOverviewPageTemplate
      title={pt('page.systemTitle')}
      description={pt('page.systemDescription')}
    >
      {state === 'saved' ? (
        <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary>
      ) : null}
      {saveFailed ? (
        <StudioFormSummary kind="error">{pt('status.saveError')}</StudioFormSummary>
      ) : null}
      <ConfigurationFields
        value={draft}
        onChange={(next) => setDraft(next as SsfSystemConfigurationInput)}
        disabled={state === 'saving'}
      />
      <StudioFormActionBar>
        <Button
          type="button"
          variant="secondary"
          disabled={state === 'saving'}
          onClick={() => setDraft(saved)}
        >
          {pt('actions.discard')}
        </Button>
        <Button
          type="button"
          disabled={state === 'saving'}
          onClick={async () => {
            setSaveFailed(false);
            setState('saving');
            try {
              const next = await writeSsfSystemConfiguration(draft);
              setSaved(next);
              setDraft(next);
              setState('saved');
            } catch {
              setSaveFailed(true);
              setState('ready');
            }
          }}
        >
          {pt(state === 'saving' ? 'actions.saving' : 'actions.save')}
        </Button>
      </StudioFormActionBar>
    </StudioOverviewPageTemplate>
  );
};

export const SsfTenantConfigurationPage = () => {
  const pt = usePluginTranslation('ssf');
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const canManage = access.permissionActions.includes('ssf.configuration.tenant.manage');
  const [system, setSystem] = useState<SsfSystemConfigurationInput | null>(null);
  const [saved, setSaved] = useState<SsfTenantConfigurationInput | null>(null);
  const [draft, setDraft] = useState<SsfTenantConfigurationInput | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'saving' | 'saved'>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await readSsfTenantConfiguration();
      setSystem(next.system);
      setSaved(next.overrides);
      setDraft(next.overrides);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (state === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (state === 'error' || !draft || !system)
    return (
      <StudioErrorState>
        <button type="button" onClick={() => void load()}>
          {pt('status.loadError')}
        </button>
      </StudioErrorState>
    );
  return (
    <StudioOverviewPageTemplate
      title={pt('page.tenantTitle')}
      description={pt('page.tenantDescription')}
    >
      {state === 'saved' ? (
        <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary>
      ) : null}
      {saveFailed ? (
        <StudioFormSummary kind="error">{pt('status.saveError')}</StudioFormSummary>
      ) : null}
      <ConfigurationFields
        value={draft}
        tenantSystem={system}
        onChange={(next) => setDraft(next as SsfTenantConfigurationInput)}
        disabled={!canManage || state === 'saving'}
      />
      {canManage ? (
        <StudioFormActionBar>
          <Button
            type="button"
            variant="secondary"
            disabled={state === 'saving'}
            onClick={() => setDraft(saved)}
          >
            {pt('actions.discard')}
          </Button>
          <Button
            type="button"
            disabled={state === 'saving'}
            onClick={async () => {
              setSaveFailed(false);
              setState('saving');
              try {
                const next = await writeSsfTenantConfiguration(draft);
                setSystem(next.system);
                setSaved(next.overrides);
                setDraft(next.overrides);
                setState('saved');
              } catch {
                setSaveFailed(true);
                setState('ready');
              }
            }}
          >
            {pt(state === 'saving' ? 'actions.saving' : 'actions.save')}
          </Button>
        </StudioFormActionBar>
      ) : null}
    </StudioOverviewPageTemplate>
  );
};
