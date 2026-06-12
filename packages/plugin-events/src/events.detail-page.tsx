import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  findHostMediaReferenceAssetId,
  fromDatetimeLocalValue,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
  toDatetimeLocalValue,
  toHostMediaFieldOptions,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';

import { createEvent, deleteEvent, EventsApiError, getEvent, listPoiForEventSelection, updateEvent } from './events.api.js';
import {
  createDefaultEventsDetailFormValues,
  mapEventItemToDetailFormValues,
  mapEventsDetailFormValuesToInput,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { EventsDetailBasisTab } from './events.detail-basis-tab.js';
import { EventsDetailContentTab } from './events.detail-content-tab.js';
import { EventsDetailHistoryTab } from './events.detail-history-tab.js';
import { EventsDetailSettingsTab } from './events.detail-settings-tab.js';
import { createEventsDetailTabDefinitions, type EventsDetailTabId } from './events.detail-tabs.js';
import { pluginEventsMediaPickers } from './plugin.js';
import type { EventContentItem, PoiSelectItem } from './events.types.js';
import { validateEventForm } from './events.validation.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

type EventsTabIconProps = Readonly<{ className?: string }>;

const EventsTabBasisIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 4.75h7.5L19 9.25v9A1.75 1.75 0 0 1 17.25 20h-10.5A1.75 1.75 0 0 1 5 18.25v-11.5A1.75 1.75 0 0 1 6.75 5Z" />
    <path d="M14 4.75v4.5h4.5" />
    <path d="M8.5 12h7" />
    <path d="M8.5 15.5h7" />
  </svg>
);

const EventsTabContentIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4.5" y="5" width="15" height="14" rx="2" />
    <path d="m8 14 2.5-2.5 2 2 2.5-3 3 4.5" />
    <circle cx="9" cy="9.5" r="1.2" />
  </svg>
);

const EventsTabSettingsIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7h10" />
    <path d="M4 17h16" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
);

const EventsTabHistoryIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 5.5v3.7h3.7" />
    <path d="M12 8.5v4l2.5 1.5" />
  </svg>
);

const eventsTabIconMap = {
  basis: EventsTabBasisIcon,
  content: EventsTabContentIcon,
  settings: EventsTabSettingsIcon,
  history: EventsTabHistoryIcon,
} as const satisfies Record<EventsDetailTabId, (props: EventsTabIconProps) => React.JSX.Element>;

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) =>
  error instanceof EventsApiError ? error.message : pt(fallbackKey);

const parseDatetimeLocalInput = (value: string, referenceValue?: string) => {
  if (value.trim().length === 0) {
    return { isInvalid: false, normalizedValue: '' };
  }

  const normalizedValue = fromDatetimeLocalValue(value, referenceValue);
  return {
    isInvalid: normalizedValue.length === 0,
    normalizedValue,
  };
};

const buildHeaderMediaReferences = (headerImageAssetId: string) =>
  headerImageAssetId
    ? [
        {
          assetId: headerImageAssetId,
          role: pluginEventsMediaPickers.headerImage.roles[0],
          sortOrder: 0,
        },
      ]
    : [];

export function EventsDetailPage({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const formId = React.useId();
  const methods = useForm<EventsDetailFormValues>({
    defaultValues: createDefaultEventsDetailFormValues(),
  });
  const { reset, setValue } = methods;
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<EventContentItem | null>(null);
  const [pois, setPois] = React.useState<readonly PoiSelectItem[]>([]);
  const [mediaOptions, setMediaOptions] = React.useState<readonly { assetId: string; label: string }[]>([]);
  const [existingMediaReferenceCount, setExistingMediaReferenceCount] = React.useState(0);
  const [dateStartInput, setDateStartInput] = React.useState('');
  const [dateEndInput, setDateEndInput] = React.useState('');
  const [invalidDateInputs, setInvalidDateInputs] = React.useState({ dateStart: false, dateEnd: false });
  const [activeTab, setActiveTab] = React.useState<EventsDetailTabId>('basis');
  const [visitedTabs, setVisitedTabs] = React.useState<readonly EventsDetailTabId[]>(['basis']);

  React.useEffect(() => {
    void listPoiForEventSelection().then(setPois).catch(() => setPois([]));
    void listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis) })
      .then((assets) => setMediaOptions(toHostMediaFieldOptions(assets)))
      .catch(() => setMediaOptions([]));
  }, []);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }

    let active = true;
    void getEvent(contentId)
      .then((item) => {
        if (!active) {
          return;
        }
        const nextValues = mapEventItemToDetailFormValues(item);
        reset(nextValues);
        setLoadedItem(item);
        setDateStartInput(toDatetimeLocalValue(nextValues.content.dates?.[0]?.dateStart));
        setDateEndInput(toDatetimeLocalValue(nextValues.content.dates?.[0]?.dateEnd));
        setInvalidDateInputs({ dateStart: false, dateEnd: false });
        setLoading(false);
        void listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'events',
          targetId: item.id,
        }).then((references) => {
          if (!active) {
            return;
          }
          setExistingMediaReferenceCount(references.length);
          setValue(
            'settings.headerImageAssetId',
            findHostMediaReferenceAssetId(references, pluginEventsMediaPickers.headerImage.roles[0]) ?? ''
          );
        }).catch(() => {
          if (active) {
            setExistingMediaReferenceCount(0);
          }
        });
      })
      .catch((loadError) => {
        if (active) {
          setStatus({ kind: 'error', text: errorMessage(pt, loadError, 'messages.missingContent') });
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, mode, reset, setValue]);

  const tabs = createEventsDetailTabDefinitions(pt);

  const warmTab = React.useCallback((tabId: EventsDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  const handleTabChange = React.useCallback(
    (tabId: EventsDetailTabId) => {
      warmTab(tabId);
      setActiveTab(tabId);
    },
    [warmTab]
  );

  const updateDateField = React.useCallback(
    (field: 'dateStart' | 'dateEnd', nextValue: string) => {
      const currentDate = methods.getValues('content.dates.0') ?? {};
      const referenceValue = currentDate[field];
      const { isInvalid, normalizedValue } = parseDatetimeLocalInput(nextValue, referenceValue);
      methods.setValue(
        'content.dates',
        [{ ...currentDate, [field]: normalizedValue }],
        { shouldDirty: true }
      );
      setInvalidDateInputs((current) => ({ ...current, [field]: isInvalid }));
      if (field === 'dateStart') {
        setDateStartInput(nextValue);
      } else {
        setDateEndInput(nextValue);
      }
    },
    [methods]
  );

  const submit = methods.handleSubmit(async (values) => {
    setStatus(null);
    const payload = mapEventsDetailFormValuesToInput(values);
    const validationErrors = [
      ...validateEventForm(payload),
      ...(invalidDateInputs.dateStart || invalidDateInputs.dateEnd ? ['dates'] : []),
    ];

    if (validationErrors.length > 0) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
      if (validationErrors.includes('dates')) {
        methods.setFocus('content.dates.0.dateStart');
        setActiveTab('content');
      } else if (validationErrors.includes('title')) {
        methods.setFocus('title');
        setActiveTab('basis');
      } else if (validationErrors.includes('urls')) {
        methods.setFocus('content.urls.0.url');
        setActiveTab('content');
      }
      return;
    }

    try {
      const saved = mode === 'create' ? await createEvent(payload) : await updateEvent(contentId as string, payload);
      const mediaReferences = buildHeaderMediaReferences(values.settings.headerImageAssetId);
      if (mediaReferences.length > 0 || existingMediaReferenceCount > 0) {
        await replaceHostMediaReferences({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'events',
          targetId: saved.id,
          references: mediaReferences,
        });
      }
      setStatus({ kind: 'success', text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess') });
      if (mode === 'create') {
        await navigate({ to: '/admin/events/$id', params: { id: saved.id } });
      }
    } catch (saveError) {
      setStatus({ kind: 'error', text: errorMessage(pt, saveError, 'messages.saveError') });
    }
  });

  const remove = async () => {
    if (!contentId || !globalThis.confirm(pt('actions.deleteConfirm'))) {
      return;
    }

    try {
      await deleteEvent(contentId);
      await navigate({ to: '/admin/content' });
    } catch (deleteError) {
      setStatus({ kind: 'error', text: errorMessage(pt, deleteError, 'messages.deleteError') });
    }
  };

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
        description={mode === 'create' ? pt('detail.createDescription') : pt('detail.editDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/content">{pt('actions.back')}</Link>
            </Button>
            {mode === 'edit' ? (
              <Button type="button" variant="destructive" onClick={() => void remove()}>
                {pt('actions.delete')}
              </Button>
            ) : null}
            <Button type="submit" form={formId}>
              {pt('actions.save')}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-5">
          {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as EventsDetailTabId)} className="space-y-0">
            <label className="block md:hidden">
              <span className="sr-only">{pt('tabs.mobileLabel')}</span>
              <select
                aria-label={pt('tabs.mobileLabel')}
                className="h-11 w-full rounded-xl border border-border/70 bg-card px-3 text-sm"
                value={activeTab}
                onChange={(event) => handleTabChange(event.target.value as EventsDetailTabId)}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </label>
            <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
              {tabs.map((tab) => {
                const TabIcon = eventsTabIconMap[tab.id];
                const isActive = tab.id === activeTab;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    onMouseEnter={() => warmTab(tab.id)}
                    onFocus={() => warmTab(tab.id)}
                    className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                      isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {tabs.map((tab) => {
              const shouldKeepMounted = visitedTabs.includes(tab.id) && tab.id !== activeTab;

              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  forceMount={shouldKeepMounted || undefined}
                  className="mt-0 data-[state=inactive]:hidden"
                >
                  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
                    <section
                      aria-label={tab.title}
                      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-1">
                        <h2 className="text-base font-semibold text-foreground">{tab.title}</h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">{tab.description}</p>
                      </div>
                    </section>
                    {tab.id === 'basis' ? <EventsDetailBasisTab loadedItem={loadedItem} mode={mode} pt={pt} /> : null}
                    {tab.id === 'content' ? (
                      <EventsDetailContentTab
                        dateEndInput={dateEndInput}
                        dateInputsInvalid={invalidDateInputs}
                        dateStartInput={dateStartInput}
                        onDateEndInputChange={(nextValue) => updateDateField('dateEnd', nextValue)}
                        onDateStartInputChange={(nextValue) => updateDateField('dateStart', nextValue)}
                        pois={pois}
                        pt={pt}
                      />
                    ) : null}
                    {tab.id === 'settings' ? <EventsDetailSettingsTab mediaOptions={mediaOptions} pt={pt} /> : null}
                    {tab.id === 'history' ? <EventsDetailHistoryTab pt={pt} /> : null}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </form>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
