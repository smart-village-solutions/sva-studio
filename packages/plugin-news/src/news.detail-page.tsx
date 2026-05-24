import React from 'react';
import { Controller, useFieldArray, useForm, type Control, type UseFormRegister } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  findHostMediaReferenceAssetId,
  formatDateTimeInEditorTimeZone,
  fromDatetimeLocalValue,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
  toDatetimeLocalValue,
  toHostMediaFieldOptions,
  translatePluginKey,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  MediaReferenceField,
  StudioDetailPageTemplate,
  StudioField,
  StudioFieldGroup,
  StudioFormSummary,
  StudioLoadingState,
  Textarea,
} from '@sva/studio-ui-react';

import { createNews, deleteNews, getNews, NewsApiError, updateNews } from './news.api.js';
import {
  createDefaultNewsDetailFormValues,
  mapNewsDetailFormValuesToMutation,
  mapNewsItemToDetailFormValues,
  newsDetailFormResolver,
} from './news.detail-form.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds, pluginNewsMediaPickers } from './plugin.js';
import type { NewsContentBlockFormValue, NewsContentItem, NewsDetailFormValues, NewsMediaContentFormValue } from './news.types.js';

type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

type FlashMessageCode = 'createSuccess' | 'deleteSuccess';

const newsFlashStorageKey = 'news-plugin-flash-message';

const errorMessageTranslationKeys: Record<string, string> = {
  missing_credentials: 'messages.errors.missingCredentials',
  forbidden: 'messages.errors.forbidden',
  graphql_error: 'messages.errors.graphqlError',
  invalid_response: 'messages.errors.invalidResponse',
  invalid_request: 'messages.errors.invalidRequest',
  csrf_validation_failed: 'messages.errors.csrfValidationFailed',
  idempotency_key_required: 'messages.errors.idempotencyKeyRequired',
  idempotency_key_reuse: 'messages.errors.idempotencyKeyReuse',
  missing_instance: 'messages.errors.missingInstance',
  network_error: 'messages.errors.networkError',
  not_found: 'messages.missingContent',
};

const resolvePluginActionLabel = (
  pt: ReturnType<typeof usePluginTranslation>,
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => {
  const definition = getPluginNewsActionDefinition(actionId);
  const titleKey = definition?.titleKey;
  if (!titleKey) {
    return actionId;
  }

  const localTitleKey = titleKey.startsWith('news.') ? titleKey.slice('news.'.length) : undefined;
  return localTitleKey ? pt(localTitleKey) : translatePluginKey('news', titleKey);
};

const resolveNewsErrorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) => {
  if (error instanceof NewsApiError) {
    const key = errorMessageTranslationKeys[error.code];
    if (key) {
      return pt(key);
    }
  }
  return pt(fallbackKey);
};

const persistFlashMessage = (code: FlashMessageCode) => {
  if (typeof globalThis.window === 'undefined') {
    return;
  }

  globalThis.window.sessionStorage.setItem(newsFlashStorageKey, code);
};

const buildDescribedBy = (...ids: readonly (string | undefined | false)[]) => {
  const describedBy = ids.filter(Boolean).join(' ');
  return describedBy.length > 0 ? describedBy : undefined;
};

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

const buildNewsMediaReferences = (teaserImageAssetId: string | null, headerImageAssetId: string | null) => [
  ...(teaserImageAssetId
    ? [{ assetId: teaserImageAssetId, role: pluginNewsMediaPickers.teaserImage.roles[0], sortOrder: 0 }]
    : []),
  ...(headerImageAssetId
    ? [{ assetId: headerImageAssetId, role: pluginNewsMediaPickers.headerImage.roles[0], sortOrder: 1 }]
    : []),
];

const shouldSyncMediaReferences = (
  existingMediaReferenceCount: number,
  mediaReferences: ReturnType<typeof buildNewsMediaReferences>
): boolean => mediaReferences.length > 0 || existingMediaReferenceCount > 0;

const formatDate = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatDateTimeInEditorTimeZone(value) ?? value;
};

const formatOptionalNumber = (value?: number) => (typeof value === 'number' ? String(value) : '—');

const formatSettings = (value: NewsContentItem['settings']) => {
  if (!value) {
    return '—';
  }
  const labels = [
    value.alwaysRecreateOnImport ? `alwaysRecreateOnImport: ${value.alwaysRecreateOnImport}` : undefined,
    value.displayOnlySummary ? `displayOnlySummary: ${value.displayOnlySummary}` : undefined,
    value.onlySummaryLinkText ? `onlySummaryLinkText: ${value.onlySummaryLinkText}` : undefined,
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : '—';
};

const createDefaultMediaContent = (): NewsMediaContentFormValue => ({
  captionText: '',
  copyright: '',
  contentType: 'image',
  height: '',
  width: '',
  sourceUrl: {
    url: '',
    description: '',
  },
});

const createDefaultContentBlock = (): NewsContentBlockFormValue => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});

type MediaFieldsProps = {
  readonly blockIndex: number;
  readonly control: Control<NewsDetailFormValues>;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly register: UseFormRegister<NewsDetailFormValues>;
};

const MediaFields = ({ blockIndex, control, pt, register }: MediaFieldsProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `contentBlocks.${blockIndex}.mediaContents`,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{pt('fields.mediaContents')}</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => append(createDefaultMediaContent())}>
          {pt('actions.addMedia')}
        </Button>
      </div>

      {fields.map((field, mediaIndex) => (
        <div key={field.id} className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
          <StudioField id={`news-media-url-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaUrl')}>
            <Input id={`news-media-url-${blockIndex}-${mediaIndex}`} type="url" {...register(`contentBlocks.${blockIndex}.mediaContents.${mediaIndex}.sourceUrl.url`)} />
          </StudioField>
          <StudioField id={`news-media-caption-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaCaption')}>
            <Input id={`news-media-caption-${blockIndex}-${mediaIndex}`} {...register(`contentBlocks.${blockIndex}.mediaContents.${mediaIndex}.captionText`)} />
          </StudioField>
          <StudioField id={`news-media-type-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaContentType')}>
            <Input id={`news-media-type-${blockIndex}-${mediaIndex}`} {...register(`contentBlocks.${blockIndex}.mediaContents.${mediaIndex}.contentType`)} />
          </StudioField>
          <div className="flex items-end justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => remove(mediaIndex)}>
              {pt('actions.remove')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

type ContentBlockSectionProps = {
  readonly blockIndex: number;
  readonly control: Control<NewsDetailFormValues>;
  readonly hasContentBlocksError: boolean;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly register: UseFormRegister<NewsDetailFormValues>;
  readonly removeBlock: (index: number) => void;
};

const ContentBlockSection = ({
  blockIndex,
  control,
  hasContentBlocksError,
  pt,
  register,
  removeBlock,
}: ContentBlockSectionProps) => (
  <section className="space-y-4 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{pt('fields.contentBlock')}</h3>
      <Button type="button" variant="outline" size="sm" onClick={() => removeBlock(blockIndex)}>
        {pt('actions.remove')}
      </Button>
    </div>

    <StudioFieldGroup columns={2}>
      <StudioField id={`news-block-title-${blockIndex}`} label={pt('fields.blockTitle')}>
        <Input id={`news-block-title-${blockIndex}`} {...register(`contentBlocks.${blockIndex}.title`)} />
      </StudioField>
      <StudioField id={`news-block-intro-${blockIndex}`} label={pt('fields.blockIntro')}>
        <Input id={`news-block-intro-${blockIndex}`} {...register(`contentBlocks.${blockIndex}.intro`)} />
      </StudioField>
    </StudioFieldGroup>

    <StudioField id={`news-block-body-${blockIndex}`} label={pt('fields.blockBody')} required>
      <Textarea
        id={`news-block-body-${blockIndex}`}
        className="min-h-48"
        aria-describedby={buildDescribedBy(hasContentBlocksError && 'news-content-blocks-error')}
        aria-invalid={hasContentBlocksError || undefined}
        {...register(`contentBlocks.${blockIndex}.body`)}
      />
    </StudioField>

    <MediaFields blockIndex={blockIndex} control={control} pt={pt} register={register} />
  </section>
);

export const NewsDetailPage = ({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) => {
  const navigate = useNavigate();
  const pt = usePluginTranslation('news');
  const submitLabel =
    mode === 'create'
      ? resolvePluginActionLabel(pt, pluginNewsActionIds.create)
      : resolvePluginActionLabel(pt, pluginNewsActionIds.update);
  const deleteLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.delete);
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [loadedItem, setLoadedItem] = React.useState<NewsContentItem | null>(null);
  const [publishedAtInput, setPublishedAtInput] = React.useState('');
  const [publicationDateInput, setPublicationDateInput] = React.useState('');
  const [invalidDateInputs, setInvalidDateInputs] = React.useState({ publishedAt: false, publicationDate: false });
  const [mediaOptions, setMediaOptions] = React.useState<readonly { assetId: string; label: string }[]>([]);
  const [existingMediaReferenceCount, setExistingMediaReferenceCount] = React.useState(0);
  const editLoadRequestIdRef = React.useRef(0);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<NewsDetailFormValues>({
    defaultValues: createDefaultNewsDetailFormValues(),
    resolver: newsDetailFormResolver,
  });

  const contentBlocksFieldArray = useFieldArray({
    control,
    name: 'contentBlocks',
  });

  const hasContentBlocksError = Boolean(errors.contentBlocks);
  const hasPublishedAtError = Boolean(errors.publishedAt) || invalidDateInputs.publishedAt;
  const hasPublicationDateError = Boolean(errors.publicationDate) || invalidDateInputs.publicationDate;

  React.useEffect(() => {
    void listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis) })
      .then((assets) => setMediaOptions(toHostMediaFieldOptions(assets)))
      .catch(() => setMediaOptions([]));
  }, []);

  React.useEffect(() => {
    if (mode !== 'edit') {
      return;
    }

    if (!contentId) {
      setIsLoading(false);
      setStatusMessage({ kind: 'error', text: pt('messages.missingContent') });
      return;
    }

    const requestId = ++editLoadRequestIdRef.current;
    let active = true;

    void getNews(contentId)
      .then((item) => {
        if (!active || requestId !== editLoadRequestIdRef.current) {
          return;
        }

        const nextValues = mapNewsItemToDetailFormValues(item);
        reset(nextValues);
        setPublishedAtInput(toDatetimeLocalValue(nextValues.publishedAt));
        setPublicationDateInput(toDatetimeLocalValue(nextValues.publicationDate));
        setInvalidDateInputs({ publishedAt: false, publicationDate: false });
        setLoadedItem(item);

        void listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'news',
          targetId: item.id,
        })
          .then((references) => {
            if (!active || requestId !== editLoadRequestIdRef.current) {
              return;
            }

            setExistingMediaReferenceCount(references.length);
            setValue('teaserImageAssetId', findHostMediaReferenceAssetId(references, pluginNewsMediaPickers.teaserImage.roles[0]));
            setValue('headerImageAssetId', findHostMediaReferenceAssetId(references, pluginNewsMediaPickers.headerImage.roles[0]));
          })
          .catch(() => {
            if (!active || requestId !== editLoadRequestIdRef.current) {
              return;
            }

            setExistingMediaReferenceCount(0);
            setValue('teaserImageAssetId', null);
            setValue('headerImageAssetId', null);
          });
      })
      .catch((error: unknown) => {
        if (active && requestId === editLoadRequestIdRef.current) {
          setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.loadError') });
        }
      })
      .finally(() => {
        if (active && requestId === editLoadRequestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, mode, pt, reset, setValue]);

  const submitValid = handleSubmit(
    async (values) => {
      if (invalidDateInputs.publishedAt) {
        setError('publishedAt', { type: 'manual', message: 'publishedAt' });
      }
      if (invalidDateInputs.publicationDate) {
        setError('publicationDate', { type: 'manual', message: 'publicationDate' });
      }
      if (invalidDateInputs.publishedAt || invalidDateInputs.publicationDate) {
        setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
        return;
      }

      try {
        const mutationInput = mapNewsDetailFormValuesToMutation(values, mode);
        const mediaReferences = buildNewsMediaReferences(values.teaserImageAssetId, values.headerImageAssetId);
        const syncMediaReferences = shouldSyncMediaReferences(existingMediaReferenceCount, mediaReferences);

        if (mode === 'create') {
          const saved = await createNews(mutationInput);
          if (syncMediaReferences) {
            await replaceHostMediaReferences({
              fetch: globalThis.fetch.bind(globalThis),
              targetType: 'news',
              targetId: saved.id,
              references: mediaReferences,
            });
          }
          persistFlashMessage('createSuccess');
          await navigate({ to: '/admin/content' });
          return;
        }

        if (contentId) {
          const saved = await updateNews(contentId, mutationInput);
          if (syncMediaReferences) {
            await replaceHostMediaReferences({
              fetch: globalThis.fetch.bind(globalThis),
              targetType: 'news',
              targetId: saved.id,
              references: mediaReferences,
            });
          }
          setStatusMessage({ kind: 'success', text: pt('messages.updateSuccess') });
        }
      } catch (error) {
        setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.saveError') });
      }
    },
    () => {
      setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
    }
  );

  const onDelete = async () => {
    if (!contentId || deletePending) {
      return;
    }

    if (globalThis.window.confirm(pt('actions.deleteConfirm')) === false) {
      return;
    }

    setDeletePending(true);

    try {
      await deleteNews(contentId);
      persistFlashMessage('deleteSuccess');
      await navigate({ to: '/admin/content' });
    } catch (error) {
      setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.deleteError') });
    } finally {
      setDeletePending(false);
    }
  };

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
      description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
    >
      {statusMessage ? <StudioFormSummary kind={statusMessage.kind}>{statusMessage.text}</StudioFormSummary> : null}

      <form className="space-y-6" onSubmit={(event) => void submitValid(event)}>
        <StudioField id="news-title" label={pt('fields.title')} required>
          <Input id="news-title" required {...register('title')} />
        </StudioField>

        <StudioFieldGroup columns={2}>
          <StudioField id="news-author" label={pt('fields.author')}>
            <Input id="news-author" {...register('author')} />
          </StudioField>
          <StudioField id="news-keywords" label={pt('fields.keywords')}>
            <Input id="news-keywords" {...register('keywords')} />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField id="news-external-id" label={pt('fields.externalId')}>
            <Input id="news-external-id" {...register('externalId')} />
          </StudioField>
          <StudioField id="news-type" label={pt('fields.newsType')}>
            <Input id="news-type" {...register('newsType')} />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-published-at"
            label={pt('fields.publishedAt')}
            error={hasPublishedAtError ? pt('validation.publishedAt') : undefined}
            errorId="news-published-at-error"
            required
          >
            <Controller
              control={control}
              name="publishedAt"
              render={({ field }) => (
                <Input
                  id="news-published-at"
                  type="datetime-local"
                  required
                  aria-describedby={buildDescribedBy(hasPublishedAtError && 'news-published-at-error')}
                  aria-invalid={hasPublishedAtError || undefined}
                  value={publishedAtInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const { isInvalid, normalizedValue } = parseDatetimeLocalInput(nextValue, field.value);
                    setPublishedAtInput(nextValue);
                    setInvalidDateInputs((current) => ({ ...current, publishedAt: isInvalid }));
                    field.onChange(normalizedValue);
                  }}
                />
              )}
            />
          </StudioField>
          <StudioField
            id="news-publication-date"
            label={pt('fields.publicationDate')}
            error={hasPublicationDateError ? pt('validation.publicationDate') : undefined}
            errorId="news-publication-date-error"
          >
            <Controller
              control={control}
              name="publicationDate"
              render={({ field }) => (
                <Input
                  id="news-publication-date"
                  type="datetime-local"
                  aria-describedby={buildDescribedBy(hasPublicationDateError && 'news-publication-date-error')}
                  aria-invalid={hasPublicationDateError || undefined}
                  value={publicationDateInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const { isInvalid, normalizedValue } = parseDatetimeLocalInput(nextValue, field.value);
                    setPublicationDateInput(nextValue);
                    setInvalidDateInputs((current) => ({ ...current, publicationDate: isInvalid }));
                    field.onChange(normalizedValue);
                  }}
                />
              )}
            />
          </StudioField>
        </StudioFieldGroup>

        <div className="grid gap-4 md:grid-cols-3">
          <StudioField
            id="news-characters"
            label={pt('fields.charactersToBeShown')}
            error={errors.charactersToBeShown ? pt('validation.charactersToBeShown') : undefined}
            errorId="news-characters-error"
          >
            <Input
              id="news-characters"
              type="number"
              min={0}
              aria-describedby={buildDescribedBy(errors.charactersToBeShown && 'news-characters-error')}
              aria-invalid={errors.charactersToBeShown ? true : undefined}
              {...register('charactersToBeShown')}
            />
          </StudioField>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Controller
              control={control}
              name="fullVersion"
              render={({ field }) => <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            />
            {pt('fields.fullVersion')}
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Controller
              control={control}
              name="showPublishDate"
              render={({ field }) => <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            />
            {pt('fields.showPublishDate')}
          </label>
        </div>

        {mode === 'create' ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <Controller
              control={control}
              name="pushNotification"
              render={({ field }) => <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            />
            {pt('fields.pushNotification')}
          </label>
        ) : null}

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-category-name"
            label={pt('fields.categoryName')}
            error={errors.categoryName ? pt('validation.categoryName') : undefined}
            errorId="news-category-name-error"
          >
            <Input
              id="news-category-name"
              aria-describedby={buildDescribedBy(errors.categoryName && 'news-category-name-error')}
              aria-invalid={errors.categoryName ? true : undefined}
              {...register('categoryName')}
            />
          </StudioField>
          <StudioField
            id="news-categories"
            label={pt('fields.categories')}
            description={pt('fields.categoriesHelp')}
            descriptionId="news-categories-help"
            error={errors.categoriesText ? pt('validation.categories') : undefined}
            errorId="news-categories-error"
          >
            <Textarea
              id="news-categories"
              aria-describedby={buildDescribedBy('news-categories-help', errors.categoriesText && 'news-categories-error')}
              aria-invalid={errors.categoriesText ? true : undefined}
              {...register('categoriesText')}
            />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <Controller
            control={control}
            name="teaserImageAssetId"
            render={({ field }) => (
              <MediaReferenceField
                id="news-teaser-image"
                label={pt('fields.teaserImage')}
                value={field.value}
                options={mediaOptions}
                onChange={field.onChange}
                placeholder={pt('fields.mediaPlaceholder')}
                clearLabel={pt('actions.clearMedia')}
              />
            )}
          />
          <Controller
            control={control}
            name="headerImageAssetId"
            render={({ field }) => (
              <MediaReferenceField
                id="news-header-image"
                label={pt('fields.headerImage')}
                value={field.value}
                options={mediaOptions}
                onChange={field.onChange}
                placeholder={pt('fields.mediaPlaceholder')}
                clearLabel={pt('actions.clearMedia')}
              />
            )}
          />
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-source-url"
            label={pt('fields.sourceUrl')}
            error={errors.sourceUrl?.url ? pt('validation.sourceUrl') : undefined}
            errorId="news-source-url-error"
          >
            <Input
              id="news-source-url"
              type="url"
              aria-describedby={buildDescribedBy(errors.sourceUrl?.url && 'news-source-url-error')}
              aria-invalid={errors.sourceUrl?.url ? true : undefined}
              {...register('sourceUrl.url')}
            />
          </StudioField>
          <StudioField id="news-source-description" label={pt('fields.sourceUrlDescription')}>
            <Input id="news-source-description" {...register('sourceUrl.description')} />
          </StudioField>
        </StudioFieldGroup>

        <div className="grid gap-4 md:grid-cols-3">
          <StudioField id="news-address-street" label={pt('fields.street')}>
            <Input id="news-address-street" {...register('address.street')} />
          </StudioField>
          <StudioField id="news-address-zip" label={pt('fields.zip')}>
            <Input id="news-address-zip" {...register('address.zip')} />
          </StudioField>
          <StudioField id="news-address-city" label={pt('fields.city')}>
            <Input id="news-address-city" {...register('address.city')} />
          </StudioField>
        </div>

        <StudioField id="news-poi" label={pt('fields.pointOfInterestId')}>
          <Input id="news-poi" {...register('pointOfInterestId')} />
        </StudioField>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{pt('fields.contentBlocks')}</h2>
            <Button type="button" variant="outline" onClick={() => contentBlocksFieldArray.append(createDefaultContentBlock())}>
              {pt('actions.addContentBlock')}
            </Button>
          </div>

          {hasContentBlocksError ? (
            <p id="news-content-blocks-error" className="text-sm text-destructive">
              {pt('validation.contentBlocks')}
            </p>
          ) : null}

          {contentBlocksFieldArray.fields.map((field, blockIndex) => (
            <ContentBlockSection
              key={field.id}
              blockIndex={blockIndex}
              control={control}
              hasContentBlocksError={hasContentBlocksError}
              pt={pt}
              register={register}
              removeBlock={contentBlocksFieldArray.remove}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">{submitLabel}</Button>
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' ? (
            <Button variant="destructive" type="button" onClick={onDelete} disabled={deletePending}>
              {deleteLabel}
            </Button>
          ) : null}
        </div>

        {mode === 'edit' && loadedItem ? (
          <section className="space-y-3 border-t border-border pt-4">
            <h2 className="text-base font-semibold">{pt('fields.technicalDetails')}</h2>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium">{pt('fields.dataProvider')}</dt>
                <dd className="text-muted-foreground">
                  {loadedItem.dataProvider?.name ?? loadedItem.dataProvider?.id ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">{pt('fields.visible')}</dt>
                <dd className="text-muted-foreground">
                  {typeof loadedItem.visible === 'boolean' ? pt(loadedItem.visible ? 'values.yes' : 'values.no') : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">{pt('fields.likeCount')}</dt>
                <dd className="text-muted-foreground">{formatOptionalNumber(loadedItem.likeCount)}</dd>
              </div>
              <div>
                <dt className="font-medium">{pt('fields.likedByMe')}</dt>
                <dd className="text-muted-foreground">
                  {typeof loadedItem.likedByMe === 'boolean' ? pt(loadedItem.likedByMe ? 'values.yes' : 'values.no') : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">{pt('fields.pushNotificationsSentAt')}</dt>
                <dd className="text-muted-foreground">{formatDate(loadedItem.pushNotificationsSentAt)}</dd>
              </div>
              <div>
                <dt className="font-medium">{pt('fields.settings')}</dt>
                <dd className="text-muted-foreground">{formatSettings(loadedItem.settings)}</dd>
              </div>
              <div>
                <dt className="font-medium">{pt('fields.announcements')}</dt>
                <dd className="text-muted-foreground">{formatOptionalNumber(loadedItem.announcements?.length)}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </form>
    </StudioDetailPageTemplate>
  );
};
