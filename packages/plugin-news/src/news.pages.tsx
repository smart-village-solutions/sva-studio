import React from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { translatePluginKey, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFieldGroup,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioDataTable,
  Textarea,
} from '@sva/studio-ui-react';

import { NewsApiError, createNews, deleteNews, getNews, listNews, updateNews } from './news.api.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds } from './plugin.js';
import type { NewsContentBlock, NewsContentItem, NewsFormInput, NewsListResult, NewsMediaContent } from './news.types.js';
import { validateNewsForm } from './news.validation.js';

type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

type FlashMessageCode = 'createSuccess' | 'deleteSuccess';

const defaultContentBlock = (): NewsContentBlock => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});

const defaultMediaContent = (): NewsMediaContent => ({
  captionText: '',
  copyright: '',
  contentType: 'image',
  sourceUrl: { url: '', description: '' },
});

const defaultForm = (): NewsFormInput => ({
  title: '',
  author: '',
  keywords: '',
  externalId: '',
  fullVersion: false,
  newsType: '',
  publishedAt: '',
  publicationDate: '',
  showPublishDate: true,
  categoryName: '',
  categories: [],
  sourceUrl: { url: '', description: '' },
  address: {},
  contentBlocks: [defaultContentBlock()],
  pointOfInterestId: '',
  pushNotification: false,
});

const newsFlashStorageKey = 'news-plugin-flash-message';

const flashMessageTranslationKeys: Record<FlashMessageCode, `messages.${FlashMessageCode}`> = {
  createSuccess: 'messages.createSuccess',
  deleteSuccess: 'messages.deleteSuccess',
};

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

const consumeFlashMessage = (): FlashMessageCode | null => {
  if (typeof globalThis.window === 'undefined') {
    return null;
  }

  const flashMessage = globalThis.window.sessionStorage.getItem(newsFlashStorageKey);
  globalThis.window.sessionStorage.removeItem(newsFlashStorageKey);

  return flashMessage === 'createSuccess' || flashMessage === 'deleteSuccess' ? flashMessage : null;
};

const buildDescribedBy = (...ids: readonly (string | undefined | false)[]) => {
  const describedBy = ids.filter(Boolean).join(' ');
  return describedBy.length > 0 ? describedBy : undefined;
};

const formatDate = (value?: string) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

const toDatetimeLocalValue = (value?: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromDatetimeLocalValue = (value: string): string => {
  if (value.length === 0) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const compactString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalNumber = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const compactWebUrl = (value: NewsFormInput['sourceUrl']) => {
  const url = compactString(value?.url);
  return url
    ? {
        url,
        ...(compactString(value?.description) ? { description: compactString(value?.description) } : {}),
      }
    : undefined;
};

const compactForm = (form: NewsFormInput, mode: 'create' | 'edit'): NewsFormInput => ({
  title: form.title.trim(),
  publishedAt: form.publishedAt,
  ...(compactString(form.author) ? { author: compactString(form.author) } : {}),
  ...(compactString(form.keywords) ? { keywords: compactString(form.keywords) } : {}),
  ...(compactString(form.externalId) ? { externalId: compactString(form.externalId) } : {}),
  ...(form.fullVersion !== undefined ? { fullVersion: form.fullVersion } : {}),
  ...(form.charactersToBeShown !== undefined ? { charactersToBeShown: form.charactersToBeShown } : {}),
  ...(compactString(form.newsType) ? { newsType: compactString(form.newsType) } : {}),
  ...(compactString(form.publicationDate) ? { publicationDate: form.publicationDate } : {}),
  ...(form.showPublishDate !== undefined ? { showPublishDate: form.showPublishDate } : {}),
  ...(compactString(form.categoryName) ? { categoryName: compactString(form.categoryName) } : {}),
  ...(form.categories && form.categories.length > 0 ? { categories: form.categories } : {}),
  ...(compactWebUrl(form.sourceUrl) ? { sourceUrl: compactWebUrl(form.sourceUrl) } : {}),
  ...(form.address &&
  (compactString(form.address.street) ||
    compactString(form.address.zip) ||
    compactString(form.address.city) ||
    compactString(form.address.addition) ||
    compactString(form.address.kind) ||
    form.address.geoLocation)
    ? { address: form.address }
    : {}),
  contentBlocks: (form.contentBlocks ?? []).map((block) => ({
    ...(compactString(block.title) ? { title: compactString(block.title) } : {}),
    ...(compactString(block.intro) ? { intro: compactString(block.intro) } : {}),
    ...(compactString(block.body) ? { body: block.body?.trim() } : {}),
    ...(block.mediaContents && block.mediaContents.length > 0
      ? {
          mediaContents: block.mediaContents
            .map((media) => ({
              ...(compactString(media.captionText) ? { captionText: compactString(media.captionText) } : {}),
              ...(compactString(media.copyright) ? { copyright: compactString(media.copyright) } : {}),
              ...(compactString(media.contentType) ? { contentType: compactString(media.contentType) } : {}),
              ...(media.height !== undefined && media.height !== '' ? { height: media.height } : {}),
              ...(media.width !== undefined && media.width !== '' ? { width: media.width } : {}),
              ...(compactWebUrl(media.sourceUrl) ? { sourceUrl: compactWebUrl(media.sourceUrl) } : {}),
            }))
            .filter((media) => Object.keys(media).length > 0),
        }
      : {}),
  })),
  ...(compactString(form.pointOfInterestId) ? { pointOfInterestId: compactString(form.pointOfInterestId) } : {}),
  ...(mode === 'create' && form.pushNotification !== undefined ? { pushNotification: form.pushNotification } : {}),
});

const itemToForm = (item: NewsContentItem): NewsFormInput => ({
  ...defaultForm(),
  title: item.title,
  author: item.author ?? '',
  keywords: item.keywords ?? '',
  externalId: item.externalId ?? '',
  fullVersion: item.fullVersion ?? false,
  charactersToBeShown: normalizeOptionalNumber(item.charactersToBeShown),
  newsType: item.newsType ?? '',
  publishedAt: item.publishedAt,
  publicationDate: item.publicationDate ?? '',
  showPublishDate: item.showPublishDate ?? true,
  categoryName: item.categoryName ?? item.payload.category ?? '',
  categories: item.categories ?? [],
  sourceUrl: item.sourceUrl ?? { url: item.payload.externalUrl ?? '', description: '' },
  address: item.address ?? {},
  contentBlocks:
    item.contentBlocks && item.contentBlocks.length > 0
      ? item.contentBlocks
      : [
          {
            intro: item.payload.teaser ?? '',
            body: item.payload.body ?? '',
            mediaContents: item.payload.imageUrl ? [{ sourceUrl: { url: item.payload.imageUrl } }] : [],
          },
        ],
  pointOfInterestId: item.pointOfInterestId ?? '',
  pushNotification: false,
});

const firstBlockSummary = (item: NewsContentItem) => {
  const firstBlock = item.contentBlocks?.[0];
  return firstBlock?.intro ?? firstBlock?.body ?? item.payload.teaser ?? '';
};

const categorySummary = (item: NewsContentItem) =>
  item.categoryName ?? item.categories?.map((category) => category.name).join(', ') ?? item.payload.category ?? '—';

const NewsForm = ({
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
  const [form, setForm] = React.useState<NewsFormInput>(defaultForm);
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [fieldErrors, setFieldErrors] = React.useState<readonly string[]>([]);
  const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [loadedItem, setLoadedItem] = React.useState<NewsContentItem | null>(null);
  const hasFieldError = React.useCallback((field: string) => fieldErrors.includes(field), [fieldErrors]);

  React.useEffect(() => {
    if (mode !== 'edit') {
      return;
    }

    if (!contentId) {
      setIsLoading(false);
      setStatusMessage({ kind: 'error', text: pt('messages.missingContent') });
      return;
    }

    let active = true;

    void getNews(contentId)
      .then((item) => {
        if (active) {
          setForm(itemToForm(item));
          setLoadedItem(item);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.loadError') });
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, mode]);

  const updateBlock = (index: number, patch: Partial<NewsContentBlock>) => {
    setForm((current) => ({
      ...current,
      contentBlocks: (current.contentBlocks ?? []).map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block
      ),
    }));
  };

  const updateMedia = (blockIndex: number, mediaIndex: number, patch: Partial<NewsMediaContent>) => {
    setForm((current) => ({
      ...current,
      contentBlocks: (current.contentBlocks ?? []).map((block, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...block,
              mediaContents: (block.mediaContents ?? []).map((media, currentMediaIndex) =>
                currentMediaIndex === mediaIndex ? { ...media, ...patch } : media
              ),
            }
          : block
      ),
    }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const compactedForm = compactForm(form, mode);
    const validationErrors = validateNewsForm(compactedForm);
    setFieldErrors(validationErrors);

    if (validationErrors.length > 0) {
      setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
      return;
    }

    try {
      if (mode === 'create') {
        await createNews(compactedForm);
        persistFlashMessage('createSuccess');
        await navigate({ to: '/admin/news' });
        return;
      }

      if (contentId) {
        await updateNews(contentId, compactedForm);
        setStatusMessage({ kind: 'success', text: pt('messages.updateSuccess') });
      }
    } catch (error) {
      setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.saveError') });
    }
  };

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
      await navigate({ to: '/admin/news' });
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

      <form className="space-y-6" onSubmit={onSubmit}>
        <StudioField id="news-title" label={pt('fields.title')} required>
          <Input
            id="news-title"
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </StudioField>

        <StudioFieldGroup columns={2}>
          <StudioField id="news-author" label={pt('fields.author')}>
            <Input
              id="news-author"
              value={form.author ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
            />
          </StudioField>
          <StudioField id="news-keywords" label={pt('fields.keywords')}>
            <Input
              id="news-keywords"
              value={form.keywords ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
            />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField id="news-external-id" label={pt('fields.externalId')}>
            <Input
              id="news-external-id"
              value={form.externalId ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, externalId: event.target.value }))}
            />
          </StudioField>
          <StudioField id="news-type" label={pt('fields.newsType')}>
            <Input
              id="news-type"
              value={form.newsType ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, newsType: event.target.value }))}
            />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-published-at"
            label={pt('fields.publishedAt')}
            error={hasFieldError('publishedAt') ? pt('validation.publishedAt') : undefined}
            errorId="news-published-at-error"
            required
          >
            <Input
              id="news-published-at"
              type="datetime-local"
              required
              aria-describedby={buildDescribedBy(hasFieldError('publishedAt') && 'news-published-at-error')}
              aria-invalid={hasFieldError('publishedAt') || undefined}
              value={toDatetimeLocalValue(form.publishedAt)}
              onChange={(event) =>
                setForm((current) => ({ ...current, publishedAt: fromDatetimeLocalValue(event.target.value) }))
              }
            />
          </StudioField>
          <StudioField
            id="news-publication-date"
            label={pt('fields.publicationDate')}
            error={hasFieldError('publicationDate') ? pt('validation.publicationDate') : undefined}
            errorId="news-publication-date-error"
          >
            <Input
              id="news-publication-date"
              type="datetime-local"
              aria-describedby={buildDescribedBy(hasFieldError('publicationDate') && 'news-publication-date-error')}
              aria-invalid={hasFieldError('publicationDate') || undefined}
              value={toDatetimeLocalValue(form.publicationDate)}
              onChange={(event) =>
                setForm((current) => ({ ...current, publicationDate: fromDatetimeLocalValue(event.target.value) }))
              }
            />
          </StudioField>
        </StudioFieldGroup>

        <div className="grid gap-4 md:grid-cols-3">
          <StudioField
            id="news-characters"
            label={pt('fields.charactersToBeShown')}
            error={hasFieldError('charactersToBeShown') ? pt('validation.charactersToBeShown') : undefined}
            errorId="news-characters-error"
          >
            <Input
              id="news-characters"
              type="number"
              min={0}
              aria-describedby={buildDescribedBy(hasFieldError('charactersToBeShown') && 'news-characters-error')}
              aria-invalid={hasFieldError('charactersToBeShown') || undefined}
              value={form.charactersToBeShown ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  charactersToBeShown: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </StudioField>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={form.fullVersion ?? false}
              onChange={(event) => setForm((current) => ({ ...current, fullVersion: event.target.checked }))}
            />
            {pt('fields.fullVersion')}
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={form.showPublishDate ?? false}
              onChange={(event) => setForm((current) => ({ ...current, showPublishDate: event.target.checked }))}
            />
            {pt('fields.showPublishDate')}
          </label>
        </div>

        {mode === 'create' ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={form.pushNotification ?? false}
              onChange={(event) => setForm((current) => ({ ...current, pushNotification: event.target.checked }))}
            />
            {pt('fields.pushNotification')}
          </label>
        ) : null}

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-category-name"
            label={pt('fields.categoryName')}
            error={hasFieldError('categoryName') ? pt('validation.categoryName') : undefined}
            errorId="news-category-name-error"
          >
            <Input
              id="news-category-name"
              aria-describedby={buildDescribedBy(hasFieldError('categoryName') && 'news-category-name-error')}
              aria-invalid={hasFieldError('categoryName') || undefined}
              value={form.categoryName ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, categoryName: event.target.value }))}
            />
          </StudioField>
          <StudioField
            id="news-categories"
            label={pt('fields.categories')}
            description={pt('fields.categoriesHelp')}
            descriptionId="news-categories-help"
            error={hasFieldError('categories') ? pt('validation.categories') : undefined}
            errorId="news-categories-error"
          >
            <Textarea
              id="news-categories"
              aria-describedby={buildDescribedBy('news-categories-help', hasFieldError('categories') && 'news-categories-error')}
              aria-invalid={hasFieldError('categories') || undefined}
              value={(form.categories ?? []).map((category) => category.name).join('\n')}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  categories: event.target.value
                    .split('\n')
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                }))
              }
            />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-source-url"
            label={pt('fields.sourceUrl')}
            error={hasFieldError('sourceUrl') ? pt('validation.sourceUrl') : undefined}
            errorId="news-source-url-error"
          >
            <Input
              id="news-source-url"
              type="url"
              aria-describedby={buildDescribedBy(hasFieldError('sourceUrl') && 'news-source-url-error')}
              aria-invalid={hasFieldError('sourceUrl') || undefined}
              value={form.sourceUrl?.url ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, sourceUrl: { ...current.sourceUrl, url: event.target.value } }))
              }
            />
          </StudioField>
          <StudioField id="news-source-description" label={pt('fields.sourceUrlDescription')}>
            <Input
              id="news-source-description"
              value={form.sourceUrl?.description ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceUrl: { ...current.sourceUrl, url: current.sourceUrl?.url ?? '', description: event.target.value },
                }))
              }
            />
          </StudioField>
        </StudioFieldGroup>

        <div className="grid gap-4 md:grid-cols-3">
          <StudioField id="news-address-street" label={pt('fields.street')}>
            <Input
              id="news-address-street"
              value={form.address?.street ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: { ...current.address, street: event.target.value } }))
              }
            />
          </StudioField>
          <StudioField id="news-address-zip" label={pt('fields.zip')}>
            <Input
              id="news-address-zip"
              value={form.address?.zip ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: { ...current.address, zip: event.target.value } }))
              }
            />
          </StudioField>
          <StudioField id="news-address-city" label={pt('fields.city')}>
            <Input
              id="news-address-city"
              value={form.address?.city ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: { ...current.address, city: event.target.value } }))
              }
            />
          </StudioField>
        </div>

        <StudioField id="news-poi" label={pt('fields.pointOfInterestId')}>
          <Input
            id="news-poi"
            value={form.pointOfInterestId ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, pointOfInterestId: event.target.value }))}
          />
        </StudioField>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{pt('fields.contentBlocks')}</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  contentBlocks: [...(current.contentBlocks ?? []), defaultContentBlock()],
                }))
              }
            >
              {pt('actions.addContentBlock')}
            </Button>
          </div>

          {hasFieldError('contentBlocks') ? (
            <p id="news-content-blocks-error" className="text-sm text-destructive">
              {pt('validation.contentBlocks')}
            </p>
          ) : null}

          {(form.contentBlocks ?? []).map((block, blockIndex) => (
            <section key={blockIndex} className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{pt('fields.contentBlock')}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      contentBlocks: (current.contentBlocks ?? []).filter((_, index) => index !== blockIndex),
                    }))
                  }
                >
                  {pt('actions.remove')}
                </Button>
              </div>

              <StudioFieldGroup columns={2}>
                <StudioField id={`news-block-title-${blockIndex}`} label={pt('fields.blockTitle')}>
                  <Input
                    id={`news-block-title-${blockIndex}`}
                    value={block.title ?? ''}
                    onChange={(event) => updateBlock(blockIndex, { title: event.target.value })}
                  />
                </StudioField>
                <StudioField id={`news-block-intro-${blockIndex}`} label={pt('fields.blockIntro')}>
                  <Input
                    id={`news-block-intro-${blockIndex}`}
                    value={block.intro ?? ''}
                    onChange={(event) => updateBlock(blockIndex, { intro: event.target.value })}
                  />
                </StudioField>
              </StudioFieldGroup>

              <StudioField id={`news-block-body-${blockIndex}`} label={pt('fields.blockBody')} required>
                <Textarea
                  id={`news-block-body-${blockIndex}`}
                  className="min-h-48"
                  aria-describedby={buildDescribedBy(hasFieldError('contentBlocks') && 'news-content-blocks-error')}
                  aria-invalid={hasFieldError('contentBlocks') || undefined}
                  value={block.body ?? ''}
                  onChange={(event) => updateBlock(blockIndex, { body: event.target.value })}
                />
              </StudioField>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">{pt('fields.mediaContents')}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateBlock(blockIndex, {
                        mediaContents: [...(block.mediaContents ?? []), defaultMediaContent()],
                      })
                    }
                  >
                    {pt('actions.addMedia')}
                  </Button>
                </div>
                {block.mediaContents?.map((media, mediaIndex) => (
                  <div key={mediaIndex} className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
                    <StudioField id={`news-media-url-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaUrl')}>
                      <Input
                        id={`news-media-url-${blockIndex}-${mediaIndex}`}
                        type="url"
                        value={media.sourceUrl?.url ?? ''}
                        onChange={(event) =>
                          updateMedia(blockIndex, mediaIndex, {
                            sourceUrl: { ...media.sourceUrl, url: event.target.value },
                          })
                        }
                      />
                    </StudioField>
                    <StudioField id={`news-media-caption-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaCaption')}>
                      <Input
                        id={`news-media-caption-${blockIndex}-${mediaIndex}`}
                        value={media.captionText ?? ''}
                        onChange={(event) => updateMedia(blockIndex, mediaIndex, { captionText: event.target.value })}
                      />
                    </StudioField>
                    <StudioField id={`news-media-type-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaContentType')}>
                      <Input
                        id={`news-media-type-${blockIndex}-${mediaIndex}`}
                        value={media.contentType ?? ''}
                        onChange={(event) => updateMedia(blockIndex, mediaIndex, { contentType: event.target.value })}
                      />
                    </StudioField>
                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateBlock(blockIndex, {
                            mediaContents: (block.mediaContents ?? []).filter((_, index) => index !== mediaIndex),
                          })
                        }
                      >
                        {pt('actions.remove')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">{submitLabel}</Button>
          <Button asChild variant="outline">
            <Link to="/admin/news">{pt('actions.back')}</Link>
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

export const NewsListPage = () => {
  const pt = usePluginTranslation('news');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const createLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.create);
  const editLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.edit);
  const page = typeof search.page === 'number' ? search.page : 1;
  const pageSize = typeof search.pageSize === 'number' ? search.pageSize : 25;
  const [result, setResult] = React.useState<NewsListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [flashMessage, setFlashMessage] = React.useState<FlashMessageCode | null>(null);

  React.useEffect(() => {
    setFlashMessage(consumeFlashMessage());
  }, []);

  React.useEffect(() => {
    let active = true;

    setIsLoading(true);
    void listNews({ page, pageSize })
      .then((nextResult) => {
        if (active) {
          setResult(nextResult);
          setError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setError(resolveNewsErrorMessage(pt, error, 'messages.loadError'));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, pageSize]);

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/news/new">{createLabel}</Link>
        </Button>
      }
    >
      {flashMessage ? (
        <StudioFormSummary kind="success">{pt(flashMessageTranslationKeys[flashMessage])}</StudioFormSummary>
      ) : null}

      {result.data.length === 0 ? (
        <StudioEmptyState>
          <h2 className="text-lg font-medium">{pt('empty.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pt('empty.description')}</p>
        </StudioEmptyState>
      ) : (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            labels={{
              selectionColumn: pt('fields.actions'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
            data={result.data}
            columns={[
              {
                id: 'title',
                header: pt('fields.title'),
                cell: (item: NewsContentItem) => (
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{firstBlockSummary(item)}</div>
                  </div>
                ),
              },
              {
                id: 'categoryName',
                header: pt('fields.categoryName'),
                cell: categorySummary,
              },
              {
                id: 'updatedAt',
                header: pt('fields.updatedAt'),
                cell: (item: NewsContentItem) => formatDate(item.updatedAt),
              },
            ]}
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/news/$id" params={{ id: item.id }}>
                  {editLabel}
                </Link>
              </Button>
            )}
            emptyState={null}
            getRowId={(item) => item.id}
            selectionMode="none"
          />

          <nav
            aria-label={pt('pagination.ariaLabel')}
            className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
          >
            <p key={result.pagination.page} aria-live="polite" className="animate-pagination-active">
              {pt('pagination.pageLabel', { page: result.pagination.page })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={result.pagination.page <= 1}
                onClick={() =>
                  void navigate({
                    to: '/admin/news',
                    search: (current: Record<string, unknown>) => ({
                      ...current,
                      page: Math.max(1, result.pagination.page - 1),
                      pageSize: result.pagination.pageSize,
                    }),
                  })
                }
              >
                {pt('pagination.previous')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!result.pagination.hasNextPage}
                onClick={() =>
                  void navigate({
                    to: '/admin/news',
                    search: (current: Record<string, unknown>) => ({
                      ...current,
                      page: result.pagination.page + 1,
                      pageSize: result.pagination.pageSize,
                    }),
                  })
                }
              >
                {pt('pagination.next')}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </StudioOverviewPageTemplate>
  );
};

export const NewsCreatePage = () => <NewsForm mode="create" />;

export const NewsEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  const contentId = typeof params.contentId === 'string' ? params.contentId : typeof params.id === 'string' ? params.id : undefined;

  return <NewsForm mode="edit" contentId={contentId} />;
};
