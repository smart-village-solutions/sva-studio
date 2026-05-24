import * as React from 'react';
import { FormProvider, useForm, type FieldNamesMarkedBoolean } from 'react-hook-form';
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
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummary,
  StudioLoadingState,
} from '@sva/studio-ui-react';

import {
  buildNewsBasisMutation,
  buildNewsContentMutation,
  buildNewsReleaseMutation,
  createNews,
  deleteNews,
  getNews,
  NewsApiError,
  updateNewsPartial,
} from './news.api.js';
import { NewsDetailBasisTab } from './news.detail-basis-tab.js';
import { NewsDetailContentTab } from './news.detail-content-tab.js';
import { NewsDetailHistoryTab } from './news.detail-history-tab.js';
import { NewsDetailReleaseTab } from './news.detail-release-tab.js';
import {
  createDefaultNewsDetailFormValues,
  deriveDirtyNewsDetailTabs,
  mapNewsDetailFormValuesToMutation,
  mapNewsItemToDetailFormValues,
  newsDetailFormResolver,
} from './news.detail-form.js';
import { createNewsDetailTabDefinitions } from './news.detail-tabs.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds, pluginNewsMediaPickers } from './plugin.js';
import type { NewsContentItem, NewsDetailFormValues, NewsDetailTabId } from './news.types.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

type FlashMessageCode = 'createSuccess' | 'deleteSuccess';
type PluginTranslator = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

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

const basisFieldNames = [
  'title',
  'author',
  'keywords',
  'categoryName',
  'categoriesText',
  'externalId',
  'newsType',
  'charactersToBeShown',
  'fullVersion',
] as const;

const contentFieldNames = [
  'teaserImageAssetId',
  'headerImageAssetId',
  'contentBlocks',
  'sourceUrl',
  'address',
  'pointOfInterestId',
] as const;

const releaseFieldNames = [
  'publishedAt',
  'publicationDate',
  'showPublishDate',
  'pushNotification',
] as const;

const resolvePluginActionLabel = (
  pt: PluginTranslator,
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

const resolveNewsErrorMessage = (pt: PluginTranslator, error: unknown, fallbackKey: string) => {
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

const getFieldNamesForTab = (tabId: NewsDetailTabId) =>
  tabId === 'basis'
    ? basisFieldNames
    : tabId === 'content'
      ? contentFieldNames
      : tabId === 'release'
        ? releaseFieldNames
        : [];

const isDirtyFieldTree = (
  value: FieldNamesMarkedBoolean<NewsDetailFormValues> | undefined
): value is FieldNamesMarkedBoolean<NewsDetailFormValues> => Boolean(value);

export const NewsDetailPage = ({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) => {
  const navigate = useNavigate();
  const pt = React.useCallback<PluginTranslator>(
    (key, variables) => translatePluginKey('news', key, variables),
    []
  );
  const submitLabel =
    mode === 'create'
      ? resolvePluginActionLabel(pt, pluginNewsActionIds.create)
      : resolvePluginActionLabel(pt, pluginNewsActionIds.update);
  const deleteLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.delete);
  const [activeTab, setActiveTab] = React.useState<NewsDetailTabId>('basis');
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

  const methods = useForm<NewsDetailFormValues>({
    defaultValues: createDefaultNewsDetailFormValues(),
    resolver: newsDetailFormResolver,
  });
  const {
    formState,
    getValues,
    reset,
    setError,
    setValue,
    trigger,
  } = methods;

  const dirtyTabs = React.useMemo(
    () =>
      formState.isDirty
        ? deriveDirtyNewsDetailTabs(
            (isDirtyFieldTree(formState.dirtyFields) ? formState.dirtyFields : {}) as Parameters<
              typeof deriveDirtyNewsDetailTabs
            >[0]
          )
        : {
            basis: false,
            content: false,
            release: false,
            history: false,
          },
    [formState.dirtyFields, formState.isDirty]
  );

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

  const syncMediaReferences = React.useCallback(
    async (values: NewsDetailFormValues, targetId: string) => {
      const mediaReferences = buildNewsMediaReferences(values.teaserImageAssetId, values.headerImageAssetId);
      if (!shouldSyncMediaReferences(existingMediaReferenceCount, mediaReferences)) {
        return;
      }

      await replaceHostMediaReferences({
        fetch: globalThis.fetch.bind(globalThis),
        targetType: 'news',
        targetId,
        references: mediaReferences,
      });
    },
    [existingMediaReferenceCount]
  );

  const saveTab = React.useCallback(
    async (tabId: NewsDetailTabId) => {
      setStatusMessage(null);
      const fieldsToValidate =
        mode === 'create' ? [...basisFieldNames, ...contentFieldNames, ...releaseFieldNames] : getFieldNamesForTab(tabId);
      if (fieldsToValidate.length > 0) {
        const valid = await trigger(fieldsToValidate);
        if (!valid) {
          setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
          return;
        }
      }

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

      const values = getValues();

      try {
        if (mode === 'create') {
          const saved = await createNews(mapNewsDetailFormValuesToMutation(values, 'create'));
          await syncMediaReferences(values, saved.id);
          persistFlashMessage('createSuccess');
          await navigate({ to: '/admin/content' });
          return;
        }

        if (!contentId) {
          setStatusMessage({ kind: 'error', text: pt('messages.missingContent') });
          return;
        }

        const mutation =
          tabId === 'basis'
            ? buildNewsBasisMutation(values)
            : tabId === 'content'
              ? buildNewsContentMutation(values)
              : tabId === 'release'
                ? buildNewsReleaseMutation(values)
              : {};

        const hasMutationFields = Object.keys(mutation).length > 0;
        let targetId = contentId;
        if (hasMutationFields) {
          const saved = await updateNewsPartial(contentId, mutation);
          targetId = saved.id;
        }
        if (tabId === 'content') {
          await syncMediaReferences(values, targetId);
        }

        reset(values);
        setStatusMessage({ kind: 'success', text: pt('messages.updateSuccess') });
      } catch (error) {
        setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.saveError') });
      }
    },
    [contentId, getValues, invalidDateInputs.publicationDate, invalidDateInputs.publishedAt, mode, navigate, pt, reset, setError, syncMediaReferences, trigger]
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

  const tabs = createNewsDetailTabDefinitions([
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      hasChanges: dirtyTabs.basis,
      changeLabel: pt('tabs.changeLabel'),
      actions: mode === 'edit' && loadedItem ? (
        <span className="text-sm text-muted-foreground">
          {pt('tabs.basis.metaSummaryInline', { publishedAt: formatDate(loadedItem.publishedAt) })}
        </span>
      ) : null,
      panel: (
        <NewsDetailBasisTab
          mode={mode}
          loadedItem={loadedItem}
          onSave={() => void saveTab('basis')}
          saveLabel={submitLabel}
          pt={pt}
        />
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      hasChanges: dirtyTabs.content,
      changeLabel: pt('tabs.changeLabel'),
      panel: (
        <NewsDetailContentTab
          mediaOptions={mediaOptions}
          onSave={() => void saveTab('content')}
          pt={pt}
          saveLabel={submitLabel}
        />
      ),
    },
    {
      id: 'release',
      label: pt('tabs.release.label'),
      title: pt('tabs.release.title'),
      description: pt('tabs.release.description'),
      hasChanges: dirtyTabs.release,
      changeLabel: pt('tabs.changeLabel'),
      panel: (
        <NewsDetailReleaseTab
          mode={mode}
          loadedItem={loadedItem}
          publishedAtField={{
            value: publishedAtInput,
            isInvalid: invalidDateInputs.publishedAt,
            onChange: (nextValue) => {
              const { isInvalid, normalizedValue } = parseDatetimeLocalInput(nextValue, methods.getValues('publishedAt'));
              setPublishedAtInput(nextValue);
              setInvalidDateInputs((current) => ({ ...current, publishedAt: isInvalid }));
              return normalizedValue;
            },
          }}
          publicationDateField={{
            value: publicationDateInput,
            isInvalid: invalidDateInputs.publicationDate,
            onChange: (nextValue) => {
              const { isInvalid, normalizedValue } = parseDatetimeLocalInput(nextValue, methods.getValues('publicationDate'));
              setPublicationDateInput(nextValue);
              setInvalidDateInputs((current) => ({ ...current, publicationDate: isInvalid }));
              return normalizedValue;
            },
          }}
          onSave={() => void saveTab('release')}
          pt={pt}
          saveLabel={submitLabel}
        />
      ),
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      panel: <NewsDetailHistoryTab contentId={contentId} pt={pt} />,
    },
  ]);

  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
      description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
      actions={
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' ? (
            <Button variant="destructive" type="button" onClick={onDelete} disabled={deletePending}>
              {deleteLabel}
            </Button>
          ) : null}
        </div>
      }
    >
      <FormProvider {...methods}>
        {statusMessage ? <StudioFormSummary kind={statusMessage.kind}>{statusMessage.text}</StudioFormSummary> : null}
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.mobileLabel')}
          tabs={tabs}
          value={activeTab}
          onValueChange={setActiveTab}
          keepMounted
          blockedTabChangeMessage={pt('messages.unsavedTabChanges')}
          onBeforeTabChange={({ currentValue }) =>
            mode === 'edit' && dirtyTabs[currentValue] ? pt('messages.unsavedTabChanges') : true
          }
        />

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
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};
