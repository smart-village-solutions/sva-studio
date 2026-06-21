import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  findHostMediaReferenceAssetId,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
  toHostMediaFieldOptions,
  uploadHostMediaFile,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailTabs,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
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
import { PoiDetailAdvancedTab } from './poi.detail-advanced-tab.js';
import { PoiDetailHistoryTab } from './poi.detail-history-tab.js';
import { PoiDetailDescriptionTab } from './poi.detail-description-tab.js';
import { PoiDetailLocationTab } from './poi.detail-location-tab.js';
import { PoiDetailContactTab } from './poi.detail-contact-tab.js';
import { PoiDetailOpeningHoursTab } from './poi.detail-opening-hours-tab.js';
import { PoiDetailLinksTab } from './poi.detail-links-tab.js';
import { PoiDetailOperatorTab } from './poi.detail-operator-tab.js';
import { PoiDetailPricesTab } from './poi.detail-prices-tab.js';
import { PoiDetailMediaTab } from './poi.detail-media-tab.js';
import { createPoiDetailTabDefinitions, type PoiDetailTabId } from './poi.detail-tabs.js';
import { pluginPoiMediaPickers } from './plugin.js';
import type { PoiContentItem } from './poi.types.js';
import { validatePoiForm } from './poi.validation.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) =>
  error instanceof PoiApiError ? error.message : pt(fallbackKey);

export function PoiDetailPage({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
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
  const [mediaOptions, setMediaOptions] = React.useState<readonly { assetId: string; label: string }[]>([]);
  const [existingMediaReferenceCount, setExistingMediaReferenceCount] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<PoiDetailTabId>('basis');
  const [mediaUploadError, setMediaUploadError] = React.useState<string | null>(null);
  const [mediaUploadSuccess, setMediaUploadSuccess] = React.useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = React.useState(false);

  const refreshMediaOptions = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis) });
      setMediaOptions(toHostMediaFieldOptions(assets));
    } catch {
      setMediaOptions([]);
    }
  }, []);

  React.useEffect(() => {
    void refreshMediaOptions();
  }, [refreshMediaOptions]);

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
        setLoading(false);
        void listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'poi',
          targetId: item.id,
        }).then((references) => {
          if (!active) {
            return;
          }
          setExistingMediaReferenceCount(references.length);
          const teaserImageAssetId =
            findHostMediaReferenceAssetId(references, pluginPoiMediaPickers.teaserImage.roles[0]) ?? '';
          setValue(
            'settings.teaserImageAssetId',
            teaserImageAssetId
          );
          setValue(
            'media.teaserImageAssetId',
            teaserImageAssetId
          );
          setValue(
            'media.attachments',
            references
              .filter((reference) => reference.role === pluginPoiMediaPickers.attachments.roles[0])
              .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
              .map((reference) => ({ assetId: reference.assetId, label: '' })),
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

  const tabs = createPoiDetailTabDefinitions(pt);

  const handleMediaUpload = React.useCallback(
    async (file: File): Promise<string | null> => {
      setIsUploadingMedia(true);
      setMediaUploadError(null);
      setMediaUploadSuccess(null);
      try {
        const uploaded = await uploadHostMediaFile({
          fetch: globalThis.fetch.bind(globalThis),
          file,
          visibility: 'protected',
          mediaType: 'image',
        });
        await refreshMediaOptions();
        setMediaUploadSuccess(pt('messages.mediaUploadSuccess'));
        return uploaded.assetId;
      } catch {
        setMediaUploadError(pt('messages.mediaUploadError'));
        return null;
      } finally {
        setIsUploadingMedia(false);
      }
    },
    [pt, refreshMediaOptions],
  );

  const handleTabChange = React.useCallback(
    (tabId: PoiDetailTabId) => {
      setActiveTab(tabId);
    },
    []
  );

  const submit = methods.handleSubmit(async (values) => {
    methods.clearErrors();
    setStatus(null);
    const payload = parsePoiPayloadText(values.content.payloadText);

    if (!payload) {
      methods.setError('content.payloadText', { type: 'manual', message: 'payload' });
      setActiveTab('advanced');
      methods.setFocus('content.payloadText');
      return;
    }

    const mutation = mapPoiDetailFormValuesToInput(values, payload);
    const validationErrors = validatePoiForm(mutation);

    if (validationErrors.length > 0) {
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
        setActiveTab('links');
      }
      return;
    }

    try {
      const saved = mode === 'create' ? await createPoi(mutation) : await updatePoi(contentId as string, mutation);
      const teaserImageAssetId = values.media.teaserImageAssetId || values.settings.teaserImageAssetId;
      const mediaReferences = [
        ...(teaserImageAssetId
          ? [
              {
                assetId: teaserImageAssetId,
                role: pluginPoiMediaPickers.teaserImage.roles[0],
                sortOrder: 0,
              },
            ]
          : []),
        ...(values.media.attachments ?? [])
          .filter((attachment) => attachment.assetId.trim().length > 0)
          .map((attachment, index) => ({
            assetId: attachment.assetId.trim(),
            role: pluginPoiMediaPickers.attachments.roles[0],
            sortOrder: index,
          })),
      ];
      if (mediaReferences.length > 0 || existingMediaReferenceCount > 0) {
        await replaceHostMediaReferences({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'poi',
          targetId: saved.id,
          references: mediaReferences,
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
    location: <PoiDetailLocationTab pt={pt} />,
    description: <PoiDetailDescriptionTab pt={pt} />,
    contact: <PoiDetailContactTab pt={pt} />,
    openingHours: <PoiDetailOpeningHoursTab pt={pt} />,
    links: <PoiDetailLinksTab pt={pt} />,
    operator: <PoiDetailOperatorTab pt={pt} />,
    prices: <PoiDetailPricesTab pt={pt} />,
    media: (
      <PoiDetailMediaTab
        mediaOptions={mediaOptions}
        isUploading={isUploadingMedia}
        uploadError={mediaUploadError}
        uploadSuccess={mediaUploadSuccess}
        onUpload={handleMediaUpload}
        pt={pt}
      />
    ),
    advanced: <PoiDetailAdvancedTab pt={pt} />,
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
          <StudioDetailTabs
            ariaLabel={pt('tabs.ariaLabel')}
            mobileSelectLabel={pt('tabs.mobileLabel')}
            value={activeTab}
            onValueChange={handleTabChange}
            tabs={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              title: tab.title,
              description: tab.description,
              panel: tabPanels[tab.id],
            }))}
          />
        </form>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
