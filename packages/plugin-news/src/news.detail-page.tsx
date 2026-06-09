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
  Select,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';

import {
  createNews,
  deleteNews,
  getNews,
  listNewsCategories,
  NewsApiError,
  saveNewsEditorItem,
  setNewsVisibility,
  updateNews,
} from './news.api.js';
import { NewsDetailBasisTab } from './news.detail-basis-tab.js';
import { NewsDetailContentTab } from './news.detail-content-tab.js';
import { NewsDetailHistoryTab } from './news.detail-history-tab.js';
import { NewsDetailReleaseTab } from './news.detail-release-tab.js';
import { NewsDetailSettingsTab } from './news.detail-settings-tab.js';
import {
  createDefaultNewsDetailFormValues,
  deriveDirtyNewsDetailTabs,
  mapNewsDetailFormValuesToMutation,
  mapNewsItemToDetailFormValues,
  newsDetailFormResolver,
} from './news.detail-form.js';
import { createNewsDetailTabDefinitions } from './news.detail-tabs.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds, pluginNewsMediaPickers } from './plugin.js';
import type {
  NewsAuthorControl,
  NewsCategoryOption,
  NewsContentItem,
  NewsDetailFormValues,
  NewsDetailTabId,
} from './news.types.js';

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

const isDirtyFieldTree = (
  value: FieldNamesMarkedBoolean<NewsDetailFormValues> | undefined
): value is FieldNamesMarkedBoolean<NewsDetailFormValues> => Boolean(value);

type NewsTabIconProps = Readonly<{ className?: string }>;

const NewsTabBasisIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 4.75h7.5L19 9.25v9A1.75 1.75 0 0 1 17.25 20h-10.5A1.75 1.75 0 0 1 5 18.25v-11.5A1.75 1.75 0 0 1 6.75 5Z" />
    <path d="M14 4.75v4.5h4.5" />
    <path d="M8.5 12h7" />
    <path d="M8.5 15.5h7" />
  </svg>
);

const NewsTabContentIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4.5" y="5" width="15" height="14" rx="2" />
    <path d="m8 14 2.5-2.5 2 2 2.5-3 3 4.5" />
    <circle cx="9" cy="9.5" r="1.2" />
  </svg>
);

const NewsTabReleaseIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M5 12h11" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const NewsTabSettingsIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7h10" />
    <path d="M4 17h16" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
);

const NewsTabHistoryIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 5.5v3.7h3.7" />
    <path d="M12 8.5v4l2.5 1.5" />
  </svg>
);

const newsTabIconMap = {
  basis: NewsTabBasisIcon,
  content: NewsTabContentIcon,
  release: NewsTabReleaseIcon,
  settings: NewsTabSettingsIcon,
  history: NewsTabHistoryIcon,
} as const satisfies Record<NewsDetailTabId, (props: NewsTabIconProps) => React.JSX.Element>;

export const NewsDetailPage = ({
  mode,
  contentId,
  initialAuthor,
  authorControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  initialAuthor?: string;
  authorControl?: NewsAuthorControl;
}>) => {
  const navigate = useNavigate();
  const pt = React.useCallback<PluginTranslator>(
    (key, variables) => translatePluginKey('news', key, variables),
    []
  );
  const deleteLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.delete);
  const headerSaveLabel = (() => {
    const label = pt('actions.save');
    return label === 'news.actions.save' ? 'Speichern' : label;
  })();
  const [activeTab, setActiveTab] = React.useState<NewsDetailTabId>('basis');
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [loadedItem, setLoadedItem] = React.useState<NewsContentItem | null>(null);
  const [publishedAtInput, setPublishedAtInput] = React.useState('');
  const [publicationDateInput, setPublicationDateInput] = React.useState('');
  const [invalidDateInputs, setInvalidDateInputs] = React.useState({ publishedAt: false, publicationDate: false });
  const [mediaOptions, setMediaOptions] = React.useState<readonly { assetId: string; label: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<readonly NewsCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  const [existingMediaReferenceCount, setExistingMediaReferenceCount] = React.useState(0);
  const [visitedTabs, setVisitedTabs] = React.useState<readonly NewsDetailTabId[]>(['basis']);
  const editLoadRequestIdRef = React.useRef(0);
  const formId = React.useId();
  const resolvedInitialAuthor = (authorControl?.value ?? initialAuthor ?? '').trim();

  const methods = useForm<NewsDetailFormValues>({
    defaultValues: createDefaultNewsDetailFormValues(resolvedInitialAuthor),
    resolver: newsDetailFormResolver,
  });
  const {
    formState,
    reset,
    setError,
    setValue,
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
            settings: false,
            history: false,
          },
    [formState.dirtyFields, formState.isDirty]
  );

  React.useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    const normalizedInitialAuthor = resolvedInitialAuthor;
    if (normalizedInitialAuthor.length === 0) {
      return;
    }

    if (formState.dirtyFields.author) {
      return;
    }

    setValue('author', normalizedInitialAuthor, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [formState.dirtyFields.author, mode, resolvedInitialAuthor, setValue]);

  React.useEffect(() => {
    let active = true;

    void listNewsCategories()
      .then((categories) => {
        if (!active) {
          return;
        }
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setCategoryOptions([]);
        setCategoryOptionsError(resolveNewsErrorMessage(pt, error, 'messages.categoryOptionsLoadError'));
      })
      .finally(() => {
        if (active) {
          setCategoryOptionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pt]);

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

  const saveCurrentItem = methods.handleSubmit(async (values) => {
    setStatusMessage(null);

    const publishedAtValidation = parseDatetimeLocalInput(publishedAtInput, methods.getValues('publishedAt'));
    const publicationDateValidation = parseDatetimeLocalInput(publicationDateInput, methods.getValues('publicationDate'));
    const nextInvalidDateInputs = {
      publishedAt: publishedAtValidation.isInvalid,
      publicationDate: publicationDateValidation.isInvalid,
    };

    setInvalidDateInputs(nextInvalidDateInputs);

    if (nextInvalidDateInputs.publishedAt) {
      setError('publishedAt', { type: 'manual', message: 'publishedAt' });
    }
    if (nextInvalidDateInputs.publicationDate) {
      setError('publicationDate', { type: 'manual', message: 'publicationDate' });
    }
    if (nextInvalidDateInputs.publishedAt || nextInvalidDateInputs.publicationDate) {
      setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
      return;
    }

    if (mode === 'edit' && !contentId) {
      setStatusMessage({ kind: 'error', text: pt('messages.missingContent') });
      return;
    }

    try {
      const saved = await saveNewsEditorItem({
        contentId,
        values,
        existingItem: loadedItem ?? null,
      }, {
        createNews,
        updateNews,
        setNewsVisibility,
      });
      await syncMediaReferences(values, saved.id);
      setExistingMediaReferenceCount(buildNewsMediaReferences(values.teaserImageAssetId, values.headerImageAssetId).length);

      if (mode === 'create') {
        persistFlashMessage('createSuccess');
        await navigate({ to: '/admin/content' });
        return;
      }

      const nextValues = {
        ...mapNewsItemToDetailFormValues(saved),
        teaserImageAssetId: values.teaserImageAssetId,
        headerImageAssetId: values.headerImageAssetId,
      };
      reset(nextValues);
      setLoadedItem(saved);
      setPublishedAtInput(toDatetimeLocalValue(nextValues.publishedAt));
      setPublicationDateInput(toDatetimeLocalValue(nextValues.publicationDate));
      setInvalidDateInputs({ publishedAt: false, publicationDate: false });
      setStatusMessage({ kind: 'success', text: pt('messages.updateSuccess') });
    } catch (error) {
      setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.saveError') });
    }
  }, () => {
    setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
  });

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

  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);

  const warmTab = React.useCallback((tabId: NewsDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  const handleTabChange = React.useCallback(
    (nextTab: NewsDetailTabId) => {
      if (nextTab === activeTab) {
        return;
      }
      setActiveTab(nextTab);
    },
    [activeTab]
  );

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
          availableCategories={categoryOptions}
          authorControl={authorControl}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          mode={mode}
          loadedItem={loadedItem}
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
          pt={pt}
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
          pt={pt}
        />
      ),
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      hasChanges: dirtyTabs.settings,
      changeLabel: pt('tabs.changeLabel'),
      panel: (
        <NewsDetailSettingsTab
          pt={pt}
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
          <Button type="submit" form={formId}>
            {headerSaveLabel}
          </Button>
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
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void saveCurrentItem();
          }}
        >
          {statusMessage ? <StudioFormSummary kind={statusMessage.kind}>{statusMessage.text}</StudioFormSummary> : null}
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as NewsDetailTabId)} className="space-y-0">
            <label className="block md:hidden">
              <span className="sr-only">{pt('tabs.mobileLabel')}</span>
              <Select
                aria-label={pt('tabs.mobileLabel')}
                className="h-11 rounded-xl border-border/70 bg-card"
                value={activeTab}
                onChange={(event) => handleTabChange(event.target.value as NewsDetailTabId)}
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
                const TabIcon = newsTabIconMap[tab.id];
                const isActive = tab.id === activeTab;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onMouseEnter={() => warmTab(tab.id)}
                    onFocus={() => warmTab(tab.id)}
                    className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                      isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                      {tab.hasChanges && tab.changeLabel ? (
                        <span className="text-xs font-medium text-foreground">{tab.changeLabel}</span>
                      ) : null}
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
                  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5 [&_.text-muted-foreground]:text-foreground">
                    <section
                      aria-label={tab.title ? String(tab.title) : tab.label}
                      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-1">
                        <h2 className="text-base font-semibold text-foreground">{tab.title ?? tab.label}</h2>
                        {tab.description ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">{tab.description}</p>
                        ) : null}
                      </div>
                      {tab.actions ? <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">{tab.actions}</div> : null}
                    </section>
                    {tab.panel}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </form>
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};
