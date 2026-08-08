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
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  Button,
  ContentMediaUsageBlock,
  contentMediaUsageToReference,
  createManualContentMediaUsage,
  Input,
  isPersistableContentMediaUrl,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  RichTextHtmlEditor,
  Select,
  StudioConfirmDialog,
  StudioContentHistory,
  StudioDataTable,
  StudioDetailCard,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioMediaPickerOverlay,
  StudioOverviewPageTemplate,
  StudioPagination,
  Textarea,
  type StudioDetailTabDefinition,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerOverlayLabels,
  useStudioMediaPickerOverlay,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';

import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects.api.js';
import type { ProjectContentItem } from './projects.api-types.js';
import {
  createDefaultProjectFormValues,
  normalizeProjectInput,
  projectToFormValues,
} from './projects.model.js';
import {
  projectAssetToMediaUsage,
  projectImagesToMediaUsages,
  projectMediaUsagesToImages,
  resolveProjectPersistentDeliveryUrl,
} from './projects.content-media-adapter.js';
import { projectFormSchema, type ProjectFormValues } from './projects.validation.js';

type ProjectTab = 'basis' | 'content' | 'settings' | 'history';
type Translate = ReturnType<typeof usePluginTranslation>;

const richTextOptions = (pt: Translate) => [
  { value: 'paragraph' as const, label: pt('richText.paragraph') },
  { value: 'heading-2' as const, label: pt('richText.heading2') },
  { value: 'heading-3' as const, label: pt('richText.heading3') },
  { value: 'heading-4' as const, label: pt('richText.heading4') },
  { value: 'blockquote' as const, label: pt('richText.blockquote') },
];

const richTextLabels = (pt: Translate) => ({
  blockType: pt('richText.blockType'),
  bulletList: pt('richText.bulletList'),
  orderedList: pt('richText.orderedList'),
  bold: pt('richText.bold'),
  italic: pt('richText.italic'),
  undo: pt('richText.undo'),
  redo: pt('richText.redo'),
  link: pt('richText.applyLink'),
  linkPrompt: pt('richText.linkInput'),
});

function ProjectImages({
  form,
  pt,
  usages,
  onChange,
  canSelectMedia,
  canUploadMedia,
  onOpenMediaPicker,
  onLoadAssetSnapshot,
}: Readonly<{
  form: ReturnType<typeof useForm<ProjectFormValues>>;
  pt: Translate;
  usages: readonly ContentMediaUsage[];
  onChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onLoadAssetSnapshot: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>) {
  const change = (next: readonly ContentMediaUsage[]) => {
    onChange(next);
    form.setValue('images', [...projectMediaUsagesToImages(next)], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <StudioDetailCard title={pt('fields.images')}>
      <ContentMediaUsageBlock
        usages={usages}
        onChange={change}
        showHeader={false}
        onAddManual={() =>
          change([...usages, createManualContentMediaUsage({ sortOrder: usages.length })])
        }
        onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
        onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        supportedFields={{ altText: true, caption: true, credit: true, license: false }}
        labels={{
          title: pt('fields.images'),
          description: pt('media.description'),
          empty: pt('messages.imagePreviewEmpty'),
          actions: {
            library: pt('actions.selectImage'),
            upload: pt('actions.uploadImage'),
            manual: pt('actions.addImage'),
            remove: pt('actions.removeImage'),
            moveUp: pt('actions.moveImageUp'),
            moveDown: pt('actions.moveImageDown'),
            refreshMetadata: pt('media.refresh'),
            cancel: pt('actions.back'),
            apply: pt('media.apply'),
          },
          fields: {
            url: pt('fields.imageUrl'),
            altText: pt('fields.altText'),
            caption: pt('fields.caption'),
            credit: pt('fields.credits'),
            license: pt('media.license'),
          },
          states: {
            linked: pt('media.linked'),
            manual: pt('media.manual'),
            synced: pt('media.synced'),
            pending: pt('media.pending'),
            missing: pt('media.missing'),
            additional: pt('media.additional'),
            unresolved: pt('media.unresolved'),
            failed: pt('media.failed'),
            previewUnavailable: pt('messages.imagePreviewEmpty'),
          },
          announcements: { moved: pt('media.moved'), removed: pt('media.removed') },
          refresh: {
            title: pt('media.refreshTitle'),
            description: pt('media.refreshDescription'),
            assetValue: pt('media.assetValue'),
            contentValue: pt('media.contentValue'),
          },
        }}
      />
    </StudioDetailCard>
  );
}

const toPickerSummary = (asset: HostMediaAssetListItem) => ({
  id: asset.id,
  title:
    (typeof asset.metadata?.title === 'string' ? asset.metadata.title.trim() : '') ||
    asset.fileName?.trim() ||
    asset.id,
  fileName: asset.fileName?.trim() || asset.id,
  previewUrl: asset.previewUrl?.trim() || null,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toPickerDetail = (
  asset: HostMediaAssetDetail,
  summary: HostMediaAssetListItem | undefined,
  persistentUrl: string | null
): StudioMediaPickerAssetDetail => {
  const fileName = summary?.fileName?.trim() || getHostMediaAssetFileName(asset);
  const summaryTitle =
    typeof summary?.metadata?.title === 'string' ? summary.metadata.title.trim() : '';
  const title = asset.metadata.title?.trim() || summaryTitle || fileName;
  return {
    id: asset.id,
    title,
    fileName,
    persistentUrl,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

const pickerLabels = (pt: Translate): StudioMediaPickerOverlayLabels => ({
  title: pt('media.pickerTitle'),
  description: pt('media.pickerDescription'),
  modes: {
    library: pt('actions.selectImage'),
    upload: pt('actions.uploadImage'),
    review: pt('media.review'),
  },
  library: {
    searchLabel: pt('media.search'),
    empty: pt('media.empty'),
    select: pt('media.select'),
  },
  upload: {
    regionLabel: pt('media.uploadRegion'),
    title: pt('actions.uploadImage'),
    description: pt('media.uploadDescription'),
    browseAction: pt('media.browse'),
    supportLabel: pt('media.uploadSupport'),
  },
  review: { title: pt('media.reviewTitle'), description: pt('media.reviewDescription') },
  fields: {
    title: pt('fields.title'),
    altText: pt('fields.altText'),
    description: pt('fields.caption'),
    copyright: pt('fields.credits'),
    license: pt('media.license'),
  },
  actions: {
    cancel: pt('actions.back'),
    backToLibrary: pt('media.backToLibrary'),
    backToUpload: pt('media.backToUpload'),
    openMediaManagement: pt('media.openManagement'),
    useMedia: pt('media.useMedia'),
  },
});

function ProjectEditor({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const form = useForm<ProjectFormValues>({
    defaultValues: createDefaultProjectFormValues(),
    resolver: zodResolver(projectFormSchema),
  });
  const [tab, setTab] = React.useState<ProjectTab>('basis');
  const [item, setItem] = React.useState<ProjectContentItem>();
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [loadError, setLoadError] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string>();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const mediaAssetsRef = React.useRef(mediaAssets);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [retryReferenceSync, setRetryReferenceSync] = React.useState<(() => Promise<void>) | null>(
    null
  );
  const [retryCreatedContentId, setRetryCreatedContentId] = React.useState<string | null>(null);
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const mediaCapabilities = React.useMemo(
    () =>
      resolveContentMediaCapabilities({
        canEditContent: true,
        permissionActions: sessionAccess.permissionActions,
      }),
    [sessionAccess.permissionActions]
  );
  const canSelectMedia = mediaCapabilities.canSelect;
  const canUploadMedia = mediaCapabilities.canUpload;
  const canUpdateMedia = mediaCapabilities.canEditAssetMetadata;

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = (
        await listHostMediaAssets({
          fetch: globalThis.fetch.bind(globalThis),
          visibility: 'public',
        })
      ).filter((asset) => asset.mimeType?.startsWith('image/'));
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, []);

  const mediaPicker = useStudioMediaPickerOverlay<StudioMediaPickerAssetDetail>({
    onAccept: (asset) => {
      if (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl)) return;
      const next = [
        ...mediaUsages,
        projectAssetToMediaUsage({
          assetId: asset.id,
          persistentUrl: asset.persistentUrl,
          previewUrl: asset.previewUrl,
          metadata: { ...asset.metadata, fileName: asset.fileName },
          sortOrder: mediaUsages.length,
        }),
      ];
      setMediaUsages(next);
      form.setValue('images', [...projectMediaUsagesToImages(next)], {
        shouldDirty: true,
        shouldValidate: true,
      });
      setRequiresReferenceSync(true);
      void refreshMediaAssets();
    },
    canAcceptAsset: (asset) =>
      Boolean(
        asset.persistentUrl &&
        isPersistableContentMediaUrl(asset.persistentUrl) &&
        mediaUsages.every((usage) => usage.assetId !== asset.id)
      ),
    isSupportedUploadFile: (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    uploadAsset: async (file) => {
      const uploaded = await uploadHostMediaFile({
        fetch: globalThis.fetch.bind(globalThis),
        file,
        visibility: 'public',
        mediaType: 'image',
      });
      await refreshMediaAssets();
      return { assetId: uploaded.assetId, previewUrl: uploaded.previewUrl };
    },
    loadAsset: async (assetId) => {
      const [asset, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
      ]);
      const persistentUrl = resolveProjectPersistentDeliveryUrl(delivery);
      return toPickerDetail(
        asset,
        mediaAssetsRef.current.find((item) => item.id === assetId),
        persistentUrl
      );
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const asset = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        visibility: 'public',
        metadata,
      });
      const delivery = await getHostMediaDelivery({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
      });
      const assets = await refreshMediaAssets();
      const persistentUrl = resolveProjectPersistentDeliveryUrl(delivery);
      return toPickerDetail(
        asset,
        assets.find((item) => item.id === assetId),
        persistentUrl
      );
    },
  });

  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    void getProject(contentId)
      .then(async (project) => {
        if (!active) return;
        const references = await listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'projects.project',
          targetId: contentId,
        }).catch(() => []);
        if (!active) return;
        setItem(project);
        form.reset(projectToFormValues(project));
        const alignments = alignHostMediaReferencesByOrder({
          itemCount: project.images.length,
          role: 'gallery_item',
          references,
        });
        setMediaUsages(projectImagesToMediaUsages(project.images, alignments));
        setRequiresReferenceSync(references.length > 0);
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [contentId, form, mode]);

  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;

  const save = form.handleSubmit(
    async (values) => {
      if (retryReferenceSync) {
        setMutationError(pt('messages.mediaReferencePartialFailure'));
        return;
      }
      setMutationError(undefined);
      try {
        const input = normalizeProjectInput({
          ...values,
          images: values.images.map((image, position) => ({ ...image, position })),
        });
        const saveContent = () =>
          mode === 'create'
            ? createProject(input, actingPrincipalType)
            : updateProject(contentId as string, input, actingPrincipalType);
        const result = requiresReferenceSync
          ? await saveContentWithHostMediaReferences({
              fetch: globalThis.fetch.bind(globalThis),
              saveContent,
              getTargetId: (saved) => saved.id,
              targetType: 'projects.project',
              references: mediaUsages.flatMap((usage) => {
                const reference = contentMediaUsageToReference(usage);
                return reference ? [reference] : [];
              }),
            })
          : { status: 'complete' as const, saved: await saveContent() };
        if (result.status === 'reference_failed') {
          setRetryReferenceSync(() => result.retryReferenceSync);
          setRetryCreatedContentId(mode === 'create' ? result.saved.id : null);
          setMediaUsages((current) =>
            current.map((usage) =>
              usage.assetId ? { ...usage, referenceStatus: 'failed' } : usage
            )
          );
          setMutationError(pt('messages.mediaReferencePartialFailure'));
          return;
        }
        setRetryReferenceSync(null);
        setRetryCreatedContentId(null);
        if (requiresReferenceSync) {
          setMediaUsages((current) =>
            current.map((usage) =>
              usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage
            )
          );
        }
        if (mode === 'create') {
          const created = result.saved;
          await navigate({ to: '/admin/projects/$id', params: { id: created.id } });
        } else if (contentId) {
          const updated = result.saved;
          setItem(updated);
          form.reset(projectToFormValues(updated));
        }
      } catch {
        setMutationError(pt('messages.saveError'));
      }
    },
    (errors) => {
      setMutationError(pt('validation.summary'));
      if (errors.fullText || errors.images) setTab('content');
      else if (errors.status) setTab('settings');
      else setTab('basis');
    }
  );

  const summaryErrors = Object.entries(form.formState.errors).map(([field, error]) => ({
    field: `project-${field}`,
    message: error?.message?.toString() ?? pt('validation.summary'),
  }));
  const formId = `project-${mode}-form`;
  const fullText = form.watch('fullText');
  const tabs: readonly StudioDetailTabDefinition<ProjectTab>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis'),
      icon: 'basis',
      panel: (
        <div className="space-y-4">
          <StudioField id="project-language" label={pt('fields.language')}>
            <Input
              id="project-language"
              aria-invalid={Boolean(form.formState.errors.language)}
              {...form.register('language')}
            />
          </StudioField>
          <StudioField id="project-title" label={pt('fields.title')}>
            <Input
              id="project-title"
              aria-invalid={Boolean(form.formState.errors.title)}
              {...form.register('title')}
            />
          </StudioField>
          <StudioField id="project-description" label={pt('fields.description')}>
            <Textarea
              id="project-description"
              className="min-h-28"
              aria-invalid={Boolean(form.formState.errors.description)}
              {...form.register('description')}
            />
          </StudioField>
        </div>
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content'),
      icon: 'content',
      panel: (
        <div className="space-y-5">
          <StudioDetailCard title={pt('fields.fullText')}>
            <div className="space-y-1">
              <label
                id="project-full-text-label"
                htmlFor="project-fullText"
                className="text-sm font-medium"
              >
                {pt('fields.fullText')}
              </label>
              <Controller
                control={form.control}
                name="fullText"
                render={({ field }) => (
                  <RichTextHtmlEditor
                    id="project-fullText"
                    labelId="project-full-text-label"
                    ariaInvalid={Boolean(form.formState.errors.fullText)}
                    value={fullText}
                    onChange={field.onChange}
                    blockTypeOptions={richTextOptions(pt)}
                    toolbarLabels={richTextLabels(pt)}
                  />
                )}
              />
            </div>
          </StudioDetailCard>
          <ProjectImages
            form={form}
            pt={pt}
            usages={mediaUsages}
            onChange={(usages) => {
              setRequiresReferenceSync(
                (required) =>
                  required ||
                  mediaUsages.some((usage) => Boolean(usage.assetId)) ||
                  usages.some((usage) => Boolean(usage.assetId))
              );
              setMediaUsages(usages);
            }}
            canSelectMedia={canSelectMedia}
            canUploadMedia={canUploadMedia}
            onOpenMediaPicker={(pickerMode) =>
              pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
            }
            onLoadAssetSnapshot={async (usage) => {
              if (!usage.assetId) throw new Error('asset_unavailable');
              const [asset, delivery] = await Promise.all([
                getHostMediaAsset({
                  fetch: globalThis.fetch.bind(globalThis),
                  assetId: usage.assetId,
                }),
                getHostMediaDelivery({
                  fetch: globalThis.fetch.bind(globalThis),
                  assetId: usage.assetId,
                }),
              ]);
              const persistentUrl = resolveProjectPersistentDeliveryUrl(delivery);
              if (!persistentUrl) throw new Error('asset_unavailable');
              return {
                persistentUrl,
                altText: asset.metadata.altText ?? '',
                caption: asset.metadata.description ?? '',
                credit: asset.metadata.copyright ?? '',
                license: asset.metadata.license ?? '',
              };
            }}
          />
        </div>
      ),
    },
    {
      id: 'settings',
      label: pt('tabs.settings'),
      icon: 'settings',
      panel: (
        <div className="space-y-4">
          <StudioField id="project-status" label={pt('fields.status')}>
            <Select
              id="project-status"
              aria-invalid={Boolean(form.formState.errors.status)}
              {...form.register('status')}
            >
              <option value="draft">{pt('status.draft')}</option>
              <option value="published">{pt('status.published')}</option>
              <option value="archived">{pt('status.archived')}</option>
            </Select>
          </StudioField>
          {item ? (
            <StudioDetailCard title={pt('tabs.settings')}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">{pt('fields.published')}</dt>
                  <dd>{pt(item.published ? 'fields.yes' : 'fields.no')}</dd>
                </div>
                <div>
                  <dt className="font-medium">{pt('fields.publishedAt')}</dt>
                  <dd>{item.publishedAt ?? pt('fields.notAvailable')}</dd>
                </div>
                <div>
                  <dt className="font-medium">{pt('fields.createdAt')}</dt>
                  <dd>{item.createdAt}</dd>
                </div>
                <div>
                  <dt className="font-medium">{pt('fields.updatedAt')}</dt>
                  <dd>{item.updatedAt}</dd>
                </div>
              </dl>
            </StudioDetailCard>
          ) : null}
        </div>
      ),
    },
    {
      id: 'history',
      label: pt('tabs.history'),
      icon: 'history',
      panel: (
        <StudioContentHistory
          contentId={contentId}
          loadHistory={(id) => fetchIamContentHistory(id, { contentType: 'projects.project' })}
          labels={{
            loading: pt('history.loading'),
            error: pt('history.error'),
            empty: pt('history.empty'),
            createHint: pt('history.createHint'),
            tableLabel: pt('history.tableLabel'),
            time: pt('history.columns.time'),
            action: pt('history.columns.action'),
            actor: pt('history.columns.actor'),
            summary: pt('history.columns.summary'),
            sourceNotice: pt('history.sourceNotice'),
            emptySummary: pt('history.emptySummary'),
          }}
          formatAction={(action) =>
            pt(
              action === 'created'
                ? 'history.actions.created'
                : action === 'status_changed'
                  ? 'history.actions.statusChanged'
                  : 'history.actions.updated'
            )
          }
          formatDate={(value) => formatDateTimeInEditorTimeZone(value) ?? value}
        />
      ),
    },
  ];

  const removeProject = async () => {
    if (!contentId) return;
    setDeletePending(true);
    try {
      await deleteProject(contentId, actingPrincipalType);
      await navigate({ to: '/admin/content' });
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
          {mode === 'edit' ? (
            <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={
        <Button
          type="submit"
          form={formId}
          disabled={form.formState.isSubmitting || Boolean(retryReferenceSync)}
        >
          {pt(mode === 'create' ? 'actions.create' : 'actions.update')}
        </Button>
      }
    >
      <StudioMediaPickerOverlay
        assets={mediaAssets.map(toPickerSummary)}
        open={mediaPicker.open}
        mode={mediaPicker.mode}
        labels={pickerLabels(pt)}
        searchValue={mediaPicker.searchValue}
        metadataDraft={mediaPicker.metadataDraft}
        reviewAsset={mediaPicker.reviewAsset}
        reviewSource={mediaPicker.reviewSource}
        uploadPhase={mediaPicker.uploadPhase}
        isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
        isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
        isMetadataEditable={canUpdateMedia}
        isAssetSelectable={(asset) => mediaUsages.every((usage) => usage.assetId !== asset.id)}
        onClose={mediaPicker.close}
        onChangeMode={(pickerMode) =>
          pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
        }
        onSearchValueChange={mediaPicker.setSearchValue}
        onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
        onUploadFile={(file) => void mediaPicker.uploadFile(file)}
        onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
        onBackFromReview={mediaPicker.goBackFromReview}
        onConfirmSelection={() => void mediaPicker.confirmSelection()}
        onOpenMediaManagement={(assetId) =>
          void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })
        }
      />
      <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
        {mutationError ? (
          <p role="alert" className="text-sm text-destructive">
            {mutationError}
          </p>
        ) : null}
        {retryReferenceSync ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void retryReferenceSync().then(
                () => {
                  setRetryReferenceSync(null);
                  setRetryCreatedContentId(null);
                  setMutationError(undefined);
                  setMediaUsages((current) =>
                    current.map((usage) =>
                      usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage
                    )
                  );
                  if (retryCreatedContentId) {
                    void navigate({
                      to: '/admin/projects/$id',
                      params: { id: retryCreatedContentId },
                    });
                  }
                },
                () => setMutationError(pt('messages.mediaReferencePartialFailure'))
              );
            }}
          >
            {pt('actions.retryMediaReferences')}
          </Button>
        ) : null}
        <StudioFormSummaryErrors errors={summaryErrors} title={pt('validation.summary')} />
        <MainserverPrincipalControl
          id="projects-acting-principal"
          label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
          description={pt('principal.description')}
          value={actingPrincipalType}
          options={resolveMainserverPrincipalOptions(principalControl, {
            value: actingPrincipalType,
            label: pt(`principal.${actingPrincipalType}`),
          })}
          onChange={setActingPrincipalType}
          dataProvider={mode === 'edit' ? item?.dataProvider : undefined}
          dataProviderLabel={pt('principal.dataProvider')}
          dataProviderUnavailableLabel={pt('principal.unavailable')}
        />
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.ariaLabel')}
          tabs={tabs}
          value={tab}
          onValueChange={setTab}
          keepMounted
        />
      </form>
      <StudioConfirmDialog
        open={deleteDialogOpen}
        title={pt('messages.deleteTitle')}
        description={pt('messages.deleteDescription')}
        confirmLabel={pt('actions.delete')}
        cancelLabel={pt('actions.back')}
        confirmDisabled={deletePending}
        cancelDisabled={deletePending}
        onConfirm={() => void removeProject()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </StudioDetailPageTemplate>
  );
}

export function ProjectsListPage() {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page ?? 1) : 1;
  const pageSize = search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25;
  const [items, setItems] = React.useState<readonly ProjectContentItem[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [hasNextPage, setHasNextPage] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void listProjects({ page, pageSize }).then(
      (result) => {
        if (!active) return;
        setItems(result.data);
        setHasNextPage(result.pagination.hasNextPage);
        setState('ready');
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
          <Link to="/admin/projects/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : null}
      {state === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {state === 'ready' && items.length === 0 ? (
        <StudioEmptyState>{pt('messages.empty')}</StudioEmptyState>
      ) : null}
      {state === 'ready' && items.length > 0 ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            data={items}
            columns={[
              { id: 'title', header: pt('fields.title'), cell: (item) => item.title },
              { id: 'language', header: pt('fields.language'), cell: (item) => item.language },
              {
                id: 'status',
                header: pt('fields.status'),
                cell: (item) => pt(`status.${item.status}`),
              },
            ]}
            rowActions={(project) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/projects/$id" params={{ id: project.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            getRowId={(project) => project.id}
            selectionMode="none"
            emptyState={null}
            labels={{
              selectionColumn: pt('fields.actions'),
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
            pageLabel={pt('pagination.pageLabel', { page })}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={(nextPage) =>
              void navigate({
                to: '/admin/projects',
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

export const ProjectsCreatePage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => (
  <ProjectEditor mode="create" principalControl={principalControl} />
);

export const ProjectsEditPage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return (
    <ProjectEditor
      mode="edit"
      contentId={params.contentId ?? params.id}
      principalControl={principalControl}
    />
  );
};
