import { zodResolver } from '@hookform/resolvers/zod';
import {
  alignHostMediaReferencesByOrder,
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
  getHostMediaAsset,
  getHostMediaAssetFileName,
  getHostMediaDelivery,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  saveContentWithHostMediaReferences,
  subscribeSessionAccessSnapshot,
  updateHostMediaAsset,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetListItem,
  type HostMediaAssetDetail,
  type IamContentHistoryEntry,
} from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  Select,
  ContentMediaUsageBlock,
  contentMediaUsageToReference,
  createManualContentMediaUsage,
  isPersistableContentMediaUrl,
  StudioDataTable,
  StudioConfirmDialog,
  StudioDetailCard,
  StudioDetailTabs,
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioMediaPickerOverlay,
  StudioOverviewPageTemplate,
  StudioPagination,
  Textarea,
  toContentMediaAssetSnapshot,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerOverlayLabels,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';

import {
  createCockpitCard,
  deleteCockpitCard,
  getCockpitCard,
  listCockpitCardCategories,
  listCockpitCards,
  updateCockpitCard,
} from './cockpit-cards.api.js';
import {
  cockpitCardFormSchema,
  mapCockpitCardFormValuesToGenericItemInput,
  mapGenericItemToCockpitCardFormValues,
  readCockpitCardPayload,
} from './cockpit-cards.model.js';
import {
  cockpitCardMediaToUsages,
  cockpitCardUsagesToMedia,
} from './cockpit-cards.content-media-adapter.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';
import { COCKPIT_CARD_CONTENT_TYPE } from './cockpit-cards.constants.js';

const defaults: CockpitCardFormValues = {
  heading: '',
  text: '',
  languageCode: 'de',
  sortWeight: 0,
  category: '',
  images: [],
  link: '',
  visible: true,
};
type Tab = 'basis' | 'content' | 'settings' | 'history';
const hasPersistablePublicDelivery = (delivery: { readonly deliveryUrl: string }): boolean =>
  (delivery as { readonly isPublicUrl?: unknown }).isPublicUrl === true &&
  isPersistableContentMediaUrl(delivery.deliveryUrl);

function useCategories() {
  const [options, setOptions] = React.useState<readonly { id: string; name: string }[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  React.useEffect(() => {
    let active = true;
    void listCockpitCardCategories().then(
      (items) => {
        if (active) {
          setOptions(items);
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, []);
  return { options, state };
}

function ContentFields({
  form,
  pt,
  mediaUsages,
  onMediaUsagesChange,
  canSelectMedia,
  canUploadMedia,
  onOpenMediaPicker,
  onLoadAssetSnapshot,
}: Readonly<{
  form: ReturnType<typeof useForm<CockpitCardFormValues>>;
  pt: (key: string) => string;
  mediaUsages: readonly ContentMediaUsage[];
  onMediaUsagesChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onLoadAssetSnapshot: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>) {
  const changeUsages = (next: readonly ContentMediaUsage[]) => {
    onMediaUsagesChange(next);
    form.setValue('images', [...cockpitCardUsagesToMedia(next)], { shouldDirty: true });
  };
  return (
    <div className="space-y-5">
      <StudioDetailCard title={pt('fields.text')}>
        <StudioField id="cockpit-card-text" label={pt('fields.text')}>
          <Textarea id="cockpit-card-text" className="min-h-32" {...form.register('text')} />
        </StudioField>
      </StudioDetailCard>
      <StudioDetailCard title={pt('fields.images')}>
        <ContentMediaUsageBlock
          usages={mediaUsages}
          onChange={changeUsages}
          onAddManual={() => changeUsages([...mediaUsages, createManualContentMediaUsage({ sortOrder: mediaUsages.length })])}
          onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
          onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
          onLoadAssetSnapshot={onLoadAssetSnapshot}
          showHeader={false}
          supportedFields={{ altText: true, caption: true, credit: true, license: false }}
          labels={{
            title: pt('fields.images'), description: pt('media.description'), empty: pt('media.empty'),
            actions: { library: pt('actions.selectImage'), upload: pt('actions.uploadImage'), manual: pt('actions.addImage'), remove: pt('actions.removeImage'), moveUp: pt('actions.moveImageUp'), moveDown: pt('actions.moveImageDown'), refreshMetadata: pt('media.refresh'), cancel: pt('media.cancel'), apply: pt('media.apply') },
            fields: { url: pt('fields.imageUrl'), altText: pt('media.altText'), caption: pt('media.caption'), credit: pt('media.credit'), license: pt('media.license') },
            states: { linked: pt('media.linked'), manual: pt('media.manual'), synced: pt('media.synced'), pending: pt('media.pending'), missing: pt('media.missing'), additional: pt('media.additional'), unresolved: pt('media.unresolved'), failed: pt('media.failed'), previewUnavailable: pt('messages.imagePreviewEmpty') },
            announcements: { moved: pt('media.moved'), removed: pt('media.removed') },
            refresh: { title: pt('media.refreshTitle'), description: pt('media.refreshDescription'), assetValue: pt('media.assetValue'), contentValue: pt('media.contentValue') },
          }}
        />
        {form.formState.errors.images ? (
          <p role="alert" className="text-sm text-destructive">
            {pt('validation.images')}
          </p>
        ) : null}
      </StudioDetailCard>
    </div>
  );
}

function Editor({ mode, contentId }: Readonly<{ mode: 'create' | 'edit'; contentId?: string }>) {
  const pt = usePluginTranslation('cockpit-cards');
  const navigate = useNavigate();
  const form = useForm<CockpitCardFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(cockpitCardFormSchema),
  });
  const [tab, setTab] = React.useState<Tab>('basis');
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [error, setError] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [payload, setPayload] = React.useState<unknown>();
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [retryReferenceSync, setRetryReferenceSync] = React.useState<(() => Promise<void>) | null>(null);
  const sessionAccess = React.useSyncExternalStore(subscribeSessionAccessSnapshot, readSessionAccessSnapshot, readSessionAccessSnapshot);
  const mediaCapabilities = React.useMemo(() => resolveContentMediaCapabilities({ canEditContent: true, permissionActions: sessionAccess.permissionActions }), [sessionAccess.permissionActions]);
  const canSelectMedia = mediaCapabilities.canSelect;
  const canUploadMedia = mediaCapabilities.canUpload;
  const canUpdateMedia = mediaCapabilities.canEditAssetMetadata;
  const { options, state: categoriesState } = useCategories();
  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = (await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis), visibility: 'public' }))
        .filter((asset) => asset.mimeType?.startsWith('image/'));
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, []);
  React.useEffect(() => { void refreshMediaAssets(); }, [refreshMediaAssets]);

  const toDetail = React.useCallback((asset: HostMediaAssetDetail, persistentUrl?: string | null): StudioMediaPickerAssetDetail => {
    const summary = mediaAssetsRef.current.find((item) => item.id === asset.id);
    const fileName = summary?.fileName ?? getHostMediaAssetFileName(asset);
    return {
      id: asset.id, fileName, title: asset.metadata.title?.trim() || fileName,
      previewUrl: asset.previewUrl ?? summary?.previewUrl ?? null, mimeType: asset.mimeType,
      visibility: asset.visibility, persistentUrl,
      metadata: { title: asset.metadata.title ?? '', altText: asset.metadata.altText ?? '', description: asset.metadata.description ?? '', copyright: asset.metadata.copyright ?? '', license: asset.metadata.license ?? '' },
    };
  }, []);
  const mediaPicker = useStudioMediaPickerOverlay<StudioMediaPickerAssetDetail>({
    onAccept: (asset) => {
      if (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl)) return;
      const usage: ContentMediaUsage = {
        uiId: `cockpit-card-asset-${asset.id}-${mediaUsages.length}`, assetId: asset.id,
        persistentUrl: asset.persistentUrl, previewUrl: asset.previewUrl ?? undefined,
        altText: asset.metadata.altText || asset.fileName, caption: asset.metadata.description || asset.title,
        credit: asset.metadata.copyright, license: asset.metadata.license,
        role: 'gallery_item', sortOrder: mediaUsages.length, referenceStatus: 'pending',
        assetSnapshot: toContentMediaAssetSnapshot({ persistentUrl: asset.persistentUrl, altText: asset.metadata.altText || asset.fileName, caption: asset.metadata.description || asset.title, credit: asset.metadata.copyright, license: asset.metadata.license }),
      };
      const next = [...mediaUsages, usage];
      setMediaUsages(next); form.setValue('images', [...cockpitCardUsagesToMedia(next)], { shouldDirty: true });
      setRequiresReferenceSync(true); void refreshMediaAssets();
    },
    canAcceptAsset: (asset) => Boolean(asset.persistentUrl && isPersistableContentMediaUrl(asset.persistentUrl) && !mediaUsages.some((usage) => usage.assetId === asset.id)),
    isSupportedUploadFile: (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    uploadAsset: async (file) => {
      const result = await uploadHostMediaFile({ fetch: globalThis.fetch.bind(globalThis), file, visibility: 'public', mediaType: 'image' });
      await refreshMediaAssets(); return { assetId: result.assetId, previewUrl: result.previewUrl };
    },
    loadAsset: async (assetId) => {
      const [asset, delivery] = await Promise.all([getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }), getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId })]);
      return toDetail(asset, hasPersistablePublicDelivery(delivery) ? delivery.deliveryUrl : null);
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const asset = await updateHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId, visibility: 'public', metadata });
      await refreshMediaAssets();
      const delivery = await getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId });
      return toDetail(asset, hasPersistablePublicDelivery(delivery) ? delivery.deliveryUrl : null);
    },
  });
  const pickerLabels: StudioMediaPickerOverlayLabels = {
    title: pt('media.pickerTitle'), description: pt('media.pickerDescription'), modes: { library: pt('actions.selectImage'), upload: pt('actions.uploadImage'), review: pt('media.review') },
    library: { searchLabel: pt('media.search'), empty: pt('media.empty'), select: pt('actions.selectImage') },
    upload: { regionLabel: pt('media.uploadRegion'), title: pt('actions.uploadImage'), description: pt('media.uploadDescription'), browseAction: pt('media.browse'), supportLabel: pt('media.support') },
    review: { title: pt('media.review'), description: pt('media.reviewDescription') },
    fields: { title: pt('fields.heading'), altText: pt('media.altText'), description: pt('media.caption'), copyright: pt('media.credit'), license: pt('media.license') },
    actions: { cancel: pt('media.cancel'), backToLibrary: pt('media.backLibrary'), backToUpload: pt('media.backUpload'), openMediaManagement: pt('media.openManagement'), useMedia: pt('media.use') },
  };
  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    void Promise.all([getCockpitCard(contentId), listHostMediaReferencesByTarget({ fetch: globalThis.fetch.bind(globalThis), targetType: COCKPIT_CARD_CONTENT_TYPE, targetId: contentId })])
      .then(
        ([item, references]) => {
          if (active) {
            const values = mapGenericItemToCockpitCardFormValues(item);
            form.reset(values);
            setMediaUsages(cockpitCardMediaToUsages(values.images, alignHostMediaReferencesByOrder({ itemCount: values.images.length, role: 'gallery_item', references })));
            setRequiresReferenceSync(references.length > 0);
            setPayload(item.payload);
          }
        },
        () => active && setError(true)
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [contentId, form, mode]);
  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (error) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  const save = form.handleSubmit(
    async (values) => {
      setMutationError(null);
      try {
        const input = mapCockpitCardFormValuesToGenericItemInput({ ...values, images: [...cockpitCardUsagesToMedia(mediaUsages)] }, payload);
        const saveContent = () => mode === 'create' ? createCockpitCard(input) : updateCockpitCard(contentId as string, input);
        const result = requiresReferenceSync ? await saveContentWithHostMediaReferences({ fetch: globalThis.fetch.bind(globalThis), saveContent, getTargetId: (saved) => saved.id, targetType: COCKPIT_CARD_CONTENT_TYPE, references: mediaUsages.flatMap((usage) => { const reference = contentMediaUsageToReference(usage); return reference ? [reference] : []; }) }) : { status: 'complete' as const, saved: await saveContent() };
        if (result.status === 'reference_failed') {
          setRetryReferenceSync(() => result.retryReferenceSync);
          setMediaUsages((current) => current.map((usage) => usage.assetId ? { ...usage, referenceStatus: 'failed' } : usage));
          setMutationError(pt('messages.mediaReferencePartialFailure')); return;
        }
        setRetryReferenceSync(null);
        if (mode === 'create') await navigate({ to: '/admin/cockpit-cards/$id', params: { id: result.saved.id } });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : '';
        setMutationError(
          reason
            ? pt('messages.saveErrorWithReason').replace('{{reason}}', reason)
            : pt('messages.saveError')
        );
      }
    },
    (errors) => {
      setMutationError(pt('messages.validationError'));
      if (errors.text || errors.images) setTab('content');
      else if (errors.link || errors.sortWeight) setTab('settings');
      else setTab('basis');
    }
  );
  const summaryErrors = [
    form.formState.errors.heading
      ? { field: 'cockpit-card-heading', message: pt('validation.required') }
      : null,
    form.formState.errors.languageCode
      ? { field: 'cockpit-card-language', message: pt('validation.languageCode') }
      : null,
    form.formState.errors.category
      ? { field: 'cockpit-card-category', message: pt('validation.required') }
      : null,
    form.formState.errors.text
      ? { field: 'cockpit-card-text', message: pt('validation.required') }
      : null,
    form.formState.errors.images
      ? { field: 'cockpit-card-image-0', message: pt('validation.images') }
      : null,
    form.formState.errors.link
      ? { field: 'cockpit-card-link', message: pt('validation.link') }
      : null,
    form.formState.errors.sortWeight
      ? { field: 'cockpit-card-weight', message: pt('validation.sortWeight') }
      : null,
  ].filter((entry): entry is { field: string; message: string } => entry !== null);
  const formId = `cockpit-card-${mode}-form`;
  const tabs: readonly StudioDetailTabDefinition<Tab>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      icon: 'basis',
      panel: (
        <div className="space-y-4">
          <StudioField id="cockpit-card-heading" label={pt('fields.heading')}>
            <Input id="cockpit-card-heading" {...form.register('heading')} />
          </StudioField>
          <StudioField id="cockpit-card-language" label={pt('fields.languageCode')}>
            <Input id="cockpit-card-language" {...form.register('languageCode')} />
          </StudioField>
          <StudioField id="cockpit-card-category" label={pt('fields.category')}>
            <Select
              id="cockpit-card-category"
              disabled={categoriesState === 'loading'}
              {...form.register('category')}
            >
              <option value="">
                {categoriesState === 'loading' ? pt('messages.categoriesLoading') : ''}
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </Select>
            {categoriesState === 'error' ? (
              <p role="alert" className="text-sm text-destructive">
                {pt('messages.categoriesError')}
              </p>
            ) : null}
          </StudioField>
        </div>
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      icon: 'content',
      panel: <ContentFields form={form} pt={pt} mediaUsages={mediaUsages} onMediaUsagesChange={setMediaUsages} canSelectMedia={canSelectMedia} canUploadMedia={canUploadMedia} onOpenMediaPicker={(pickerMode) => pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()} onLoadAssetSnapshot={async (usage) => {
        if (!usage.assetId) throw new Error('missing_asset_id');
        const [asset, delivery] = await Promise.all([getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }), getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId })]);
        if (!hasPersistablePublicDelivery(delivery)) throw new Error('non_persistable_delivery_url');
        const detail = toDetail(asset, delivery.deliveryUrl);
        return toContentMediaAssetSnapshot({ persistentUrl: delivery.deliveryUrl, altText: detail.metadata.altText || detail.fileName, caption: detail.metadata.description || detail.title, credit: detail.metadata.copyright, license: detail.metadata.license });
      }} />,
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      icon: 'settings',
      panel: (
        <div className="space-y-4">
          <StudioDetailCard title={pt('fields.link')}>
            <StudioField id="cockpit-card-link" label={pt('fields.link')}>
              <Input id="cockpit-card-link" type="url" {...form.register('link')} />
            </StudioField>
          </StudioDetailCard>
          <StudioField id="cockpit-card-publication" label={pt('fields.publicationDate')}>
            <Input id="cockpit-card-publication" {...form.register('publicationDate')} />
          </StudioField>
          <StudioField id="cockpit-card-weight" label={pt('fields.sortWeight')}>
            <Input
              id="cockpit-card-weight"
              type="number"
              {...form.register('sortWeight', { valueAsNumber: true })}
            />
          </StudioField>
          <StudioField id="cockpit-card-visible" label={pt('fields.visible')}>
            <Controller
              control={form.control}
              name="visible"
              render={({ field }) => (
                <Checkbox
                  id="cockpit-card-visible"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          </StudioField>
        </div>
      ),
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      icon: 'history',
      isVisible: mode === 'edit' && Boolean(contentId),
      panel: contentId ? <CockpitCardsHistory contentId={contentId} /> : null,
    },
  ];
  const deleteCard = async () => {
    if (!contentId) return;
    setMutationError(null);
    setDeletePending(true);
    try {
      await deleteCockpitCard(contentId);
      await navigate({ to: '/admin/content' });
      setDeleteDialogOpen(false);
    } catch {
      setMutationError(pt('messages.deleteError'));
    } finally {
      setDeletePending(false);
    }
  };
  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      description={pt(mode === 'create' ? 'editor.createDescription' : 'editor.editDescription')}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' && contentId ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending || form.formState.isSubmitting}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={
        <Button type="submit" form={formId} disabled={form.formState.isSubmitting || deletePending}>
          {pt(mode === 'create' ? 'actions.create' : 'actions.update')}
        </Button>
      }
    >
      <StudioMediaPickerOverlay
        assets={mediaAssets.map((asset) => ({ id: asset.id, title: typeof asset.metadata?.title === 'string' ? asset.metadata.title : asset.fileName ?? asset.id, fileName: asset.fileName ?? asset.id, previewUrl: asset.previewUrl ?? null, mimeType: asset.mimeType, visibility: asset.visibility }))}
        open={mediaPicker.open} mode={mediaPicker.mode} labels={pickerLabels}
        reviewAsset={mediaPicker.reviewAsset} reviewSource={mediaPicker.reviewSource}
        metadataDraft={mediaPicker.metadataDraft} searchValue={mediaPicker.searchValue}
        uploadPhase={mediaPicker.uploadPhase} isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
        isSavingReviewAsset={mediaPicker.isSavingReviewAsset} isMetadataEditable={canUpdateMedia}
        feedbackMessage={mediaPicker.errorCode ? pt('messages.mediaError') : null} feedbackTone={mediaPicker.errorCode ? 'error' : 'default'}
        isAssetSelectable={(asset) => !mediaUsages.some((usage) => usage.assetId === asset.id)}
        onClose={mediaPicker.close} onBackFromReview={mediaPicker.goBackFromReview}
        onChangeMode={(next) => next === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()}
        onSearchValueChange={mediaPicker.setSearchValue} onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
        onUploadFile={(file) => void mediaPicker.uploadFile(file)} onConfirmSelection={() => void mediaPicker.confirmSelection()}
        onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
        onOpenMediaManagement={(assetId) => void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })}
      />
      <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
        {mutationError ? (
          <p role="alert" className="text-sm text-destructive">
            {mutationError}
          </p>
        ) : null}
        {retryReferenceSync ? <Button type="button" variant="outline" onClick={() => void retryReferenceSync().then(() => { setRetryReferenceSync(null); setMediaUsages((current) => current.map((usage) => usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage)); setMutationError(null); }, () => setMutationError(pt('messages.mediaReferencePartialFailure')))}>{pt('actions.retryMediaReferences')}</Button> : null}
        <StudioFormSummaryErrors
          errors={summaryErrors}
          title={pt('validation.summaryTitle')}
          onSelectError={({ field }) => {
            if (field.includes('text') || field.includes('image')) setTab('content');
            else if (field.includes('link') || field.includes('weight')) setTab('settings');
            else setTab('basis');
          }}
        />
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.mobileLabel')}
          tabs={tabs}
          value={tab}
          onValueChange={setTab}
          keepMounted
        />
      </form>
      <StudioConfirmDialog
        open={deleteDialogOpen}
        title={pt('deleteDialog.title')}
        description={pt('deleteDialog.description')}
        confirmLabel={pt('deleteDialog.confirm')}
        cancelLabel={pt('deleteDialog.cancel')}
        confirmDisabled={deletePending}
        cancelDisabled={deletePending}
        onConfirm={() => void deleteCard()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </StudioDetailPageTemplate>
  );
}

export function CockpitCardsHistory({ contentId }: Readonly<{ contentId: string }>) {
  const pt = usePluginTranslation('cockpit-cards');
  const [entries, setEntries] = React.useState<readonly IamContentHistoryEntry[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  React.useEffect(() => {
    let active = true;
    void fetchIamContentHistory(contentId).then(
      (nextEntries) => {
        if (active) {
          setEntries(
            [...nextEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          );
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [contentId]);
  if (state === 'loading') return <StudioLoadingState>{pt('history.loading')}</StudioLoadingState>;
  if (state === 'error')
    return (
      <p role="alert" className="text-sm text-destructive">
        {pt('history.error')}
      </p>
    );
  if (!entries.length)
    return <p className="text-sm text-muted-foreground">{pt('history.empty')}</p>;
  const formatAction = (action: string) => {
    if (action === 'created' || action === 'create') return pt('history.actions.created');
    if (action === 'updated' || action === 'update') return pt('history.actions.updated');
    if (action === 'status_changed' || action === 'statusChanged')
      return pt('history.actions.statusChanged');
    return action;
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm" aria-label={pt('history.label')}>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th>{pt('history.time')}</th>
              <th>{pt('history.action')}</th>
              <th>{pt('history.actor')}</th>
              <th>{pt('history.summary')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  {formatDateTimeInEditorTimeZone(entry.createdAt) ?? entry.createdAt}
                </td>
                <td className="px-3 py-3">{formatAction(entry.action)}</td>
                <td className="px-3 py-3">{entry.actor}</td>
                <td className="px-3 py-3">{entry.summary || entry.changedFields.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CockpitCardsListPage() {
  const pt = usePluginTranslation('cockpit-cards');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page ?? 1) : 1;
  const pageSize = search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25;
  const [items, setItems] = React.useState<readonly Awaited<ReturnType<typeof getCockpitCard>>[]>(
    []
  );
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [hasNextPage, setHasNextPage] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void listCockpitCards({ page, pageSize }).then(
      (result) => {
        if (active) {
          setItems(result.data);
          setHasNextPage(result.pagination.hasNextPage);
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [page, pageSize]);
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/cockpit-cards/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : null}
      {state === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {state === 'ready' && items.length === 0 ? (
        <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
      ) : null}
      {state === 'ready' && items.length ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            data={items}
            columns={[
              { id: 'heading', header: pt('fields.heading'), cell: (item) => item.title },
              {
                id: 'language',
                header: pt('fields.languageCode'),
                cell: (item) => readCockpitCardPayload(item.payload).languageCode,
              },
            ]}
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/cockpit-cards/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            getRowId={(item) => item.id}
            selectionMode="none"
            emptyState={null}
            labels={{
              selectionColumn: pt('fields.heading'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
          />
          <StudioPagination
            page={page}
            hasNextPage={hasNextPage}
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel').replace('{{page}}', String(page))}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={(nextPage) =>
              void navigate({
                to: '/admin/cockpit-cards',
                search: (current: Record<string, unknown>) => ({
                  ...current,
                  page: nextPage,
                  pageSize,
                }),
              })
            }
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const CockpitCardsCreatePage = () => <Editor mode="create" />;
export const CockpitCardsEditPage = () => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return <Editor mode="edit" contentId={params.contentId ?? params.id} />;
};
