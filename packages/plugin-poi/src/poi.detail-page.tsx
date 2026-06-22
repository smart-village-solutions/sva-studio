import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
  usePluginTranslation,
  type HostMediaAssetListItem,
  type HostMediaReferenceSelection,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';

import { createPoi, deletePoi, getPoi, PoiApiError, updatePoi } from './poi.api.js';
import { PoiDetailBasisTab } from './poi.detail-basis-tab.js';
import {
  createDefaultPoiDetailFormValues,
  mapPoiDetailFormValuesToInput,
  mapPoiItemToDetailFormValues,
  parsePoiPayloadText,
  type PoiDetailFormValues,
} from './poi.detail-form.js';
import { PoiDetailContentTab } from './poi.detail-content-tab.js';
import { PoiDetailHistoryTab } from './poi.detail-history-tab.js';
import { normalizePoiMediaAssetId } from './poi.media-asset-id.js';
import { createPoiDetailTabDefinitions, type PoiDetailTabId } from './poi.detail-tabs.js';
import { PoiDetailSettingsTab } from './poi.detail-settings-tab.js';
import { pluginPoiMediaPickers } from './plugin.js';
import type { PoiContentItem } from './poi.types.js';
import { validatePoiForm } from './poi.validation.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) =>
  error instanceof PoiApiError ? error.message : pt(fallbackKey);

const renderPoiTabPanel = ({
  title,
  description,
  panel,
}: Readonly<{
  title: string;
  description: string;
  panel: React.JSX.Element;
}>) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
    </section>
    {panel}
  </div>
);

const PoiTabTriggerLabel = ({ label }: Readonly<{ label: string }>) => <span>{label}</span>;

export function PoiDetailPage({
  mode,
  contentId,
  instanceId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  instanceId?: string;
}>) {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const formId = React.useId();
  const methods = useForm<PoiDetailFormValues>({
    defaultValues: createDefaultPoiDetailFormValues(),
  });
  const { reset, setValue } = methods;
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<PoiContentItem | null>(null);
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [preservedMediaReferences, setPreservedMediaReferences] = React.useState<readonly HostMediaReferenceSelection[]>([]);
  const [loadedOwnedMediaReferenceCount, setLoadedOwnedMediaReferenceCount] = React.useState(0);
  const [mediaReferencesLoadFailed, setMediaReferencesLoadFailed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<PoiDetailTabId>('basis');
  const [visitedTabs, setVisitedTabs] = React.useState<readonly PoiDetailTabId[]>(['basis']);
  const focusFieldById = React.useCallback((fieldId: string) => {
    globalThis.setTimeout(() => {
      globalThis.document.getElementById(fieldId)?.focus();
    }, 0);
  }, []);

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis), instanceId });
      setMediaAssets(assets);
    } catch {
      setMediaAssets([]);
    }
  }, [instanceId]);

  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }

    let active = true;
    void getPoi(contentId)
      .then((item) => {
        if (!active) {
          return;
        }
        reset(mapPoiItemToDetailFormValues(item));
        setLoadedItem(item);
        void listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          instanceId,
          targetType: 'poi',
          targetId: item.id,
        }).then((references) => {
          if (!active) {
            return;
          }
          setMediaReferencesLoadFailed(false);
          const ownedRole = pluginPoiMediaPickers.images.roles[0];
          const ownedReferences = references.filter((reference) => reference.role === ownedRole);
          setLoadedOwnedMediaReferenceCount(ownedReferences.length);
          setPreservedMediaReferences(references.filter((reference) => reference.role !== ownedRole));
          setValue(
            'media.images',
            ownedReferences
              .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
              .map((reference) => normalizePoiMediaAssetId(reference.assetId))
              .filter((assetId) => assetId.length > 0)
              .map((assetId) => ({ assetId, label: '' })),
          );
          setLoading(false);
        }).catch(() => {
          if (active) {
            setLoadedOwnedMediaReferenceCount(0);
            setPreservedMediaReferences([]);
            setMediaReferencesLoadFailed(true);
            setLoading(false);
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
  }, [contentId, instanceId, mode, reset, setValue]);

  const tabs = createPoiDetailTabDefinitions(pt);

  const handleTabChange = React.useCallback(
    (tabId: PoiDetailTabId) => {
      if (tabId === activeTab) {
        return;
      }
      setActiveTab(tabId);
    },
    [activeTab]
  );

  const warmTab = React.useCallback((tabId: PoiDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);

  const submit = methods.handleSubmit(async (values) => {
    methods.clearErrors();
    setStatus(null);
    const payload = parsePoiPayloadText(values.content.payloadText);

    if (!payload) {
      methods.setError('content.payloadText', { type: 'manual', message: 'payload' });
      setActiveTab('settings');
      methods.setFocus('content.payloadText');
      return;
    }

    const mutation = mapPoiDetailFormValuesToInput(values, payload);
    const validationErrors = validatePoiForm(mutation);

    if (validationErrors.length > 0) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
      if (validationErrors.includes('name')) {
        methods.setError('name', { type: 'manual', message: 'name' });
        methods.setFocus('name');
        setActiveTab('basis');
      }
      if (validationErrors.includes('categoryName')) {
        methods.setError('basis.categoryName', { type: 'manual', message: 'categoryName' });
        if (!validationErrors.includes('name')) {
          methods.setFocus('basis.categoryName');
        }
        setActiveTab('basis');
      }
      if (validationErrors.includes('webUrls')) {
        methods.setError('content.webUrls.0.url', { type: 'manual', message: 'webUrls' });
        if (!validationErrors.includes('name') && !validationErrors.includes('categoryName')) {
          methods.setFocus('content.webUrls.0.url');
        }
        setActiveTab('content');
      }
      if (validationErrors.includes('contact.webUrls')) {
        methods.setError('content.contact.webUrls.0.url', { type: 'manual', message: 'webUrls' });
        setActiveTab('content');
        focusFieldById('poi-contact-url');
      }
      if (validationErrors.includes('addresses')) {
        methods.setError('content.addresses.0.geoLocation.latitude', { type: 'manual', message: 'addresses' });
        setActiveTab('content');
      }
      if (validationErrors.includes('location')) {
        methods.setError('content.location.geoLocation.latitude', { type: 'manual', message: 'location' });
        setActiveTab('content');
      }
      if (validationErrors.includes('priceInformations')) {
        methods.setError('content.prices.0.amount', { type: 'manual', message: 'priceInformations' });
        setActiveTab('content');
      }
      if (validationErrors.includes('operatingCompany.contact.webUrls')) {
        methods.setError('content.operator.contact.webUrls.0.url', {
          type: 'manual',
          message: 'webUrls',
        });
        setActiveTab('content');
        focusFieldById('poi-operator-url');
      }
      return;
    }

    try {
      const saved = mode === 'create' ? await createPoi(mutation) : await updatePoi(contentId as string, mutation);
      const mediaReferences = (values.media.images ?? [])
        .map((image) => normalizePoiMediaAssetId(image.assetId))
        .filter((assetId) => assetId.length > 0)
        .map((assetId, index) => ({
          assetId,
          role: pluginPoiMediaPickers.images.roles[0],
          sortOrder: index,
        }));
      if (mediaReferencesLoadFailed && mediaReferences.length > 0) {
        setStatus({ kind: 'error', text: pt('messages.mediaReferencesUnavailable') });
        setActiveTab('settings');
        return;
      }
      const nextReferences = [...preservedMediaReferences, ...mediaReferences];
      if (nextReferences.length > 0 || loadedOwnedMediaReferenceCount > 0) {
        await replaceHostMediaReferences({
          fetch: globalThis.fetch.bind(globalThis),
          instanceId,
          targetType: 'poi',
          targetId: saved.id,
          references: nextReferences,
        });
      }
      setStatus({ kind: 'success', text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess') });
      if (mode === 'create') {
        await navigate({ to: '/admin/poi/$id', params: { id: saved.id } });
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
      await deletePoi(contentId);
      await navigate({ to: '/admin/content' });
    } catch (deleteError) {
      setStatus({ kind: 'error', text: errorMessage(pt, deleteError, 'messages.deleteError') });
    }
  };

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  const tabPanels = {
    basis: <PoiDetailBasisTab loadedItem={loadedItem} mode={mode} pt={pt} />,
    content: <PoiDetailContentTab pt={pt} />,
    settings: <PoiDetailSettingsTab mediaAssets={mediaAssets} pt={pt} />,
    history: <PoiDetailHistoryTab pt={pt} />,
  } as const satisfies Record<PoiDetailTabId, React.JSX.Element>;

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
        <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-5" noValidate>
          {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as PoiDetailTabId)} className="space-y-0">
            <label className="block md:hidden">
              <span className="sr-only">{pt('tabs.mobileLabel')}</span>
              <Select
                aria-label={pt('tabs.mobileLabel')}
                className="h-11 rounded-xl border-border/70 bg-card"
                value={activeTab}
                onChange={(event) => handleTabChange(event.target.value as PoiDetailTabId)}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </Select>
            </label>
            <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onMouseEnter={() => warmTab(tab.id)}
                    onFocus={() => warmTab(tab.id)}
                    className={`relative z-10 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                      isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    <PoiTabTriggerLabel label={tab.label} />
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
                  {renderPoiTabPanel({
                    title: tab.title,
                    description: tab.description,
                    panel: tabPanels[tab.id],
                  })}
                </TabsContent>
              );
            })}
          </Tabs>
        </form>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
