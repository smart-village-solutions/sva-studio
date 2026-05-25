import React from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { formatDateTimeInEditorTimeZone, translatePluginKey } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';

import { listNews, NewsApiError } from './news.api.js';
import { NewsDetailPage } from './news.detail-page.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds } from './plugin.js';
import type { NewsContentItem, NewsListResult } from './news.types.js';

type FlashMessageCode = 'createSuccess' | 'deleteSuccess';
type PluginTranslator = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

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

const consumeFlashMessage = (): FlashMessageCode | null => {
  if (typeof globalThis.window === 'undefined') {
    return null;
  }

  const flashMessage = globalThis.window.sessionStorage.getItem(newsFlashStorageKey);
  globalThis.window.sessionStorage.removeItem(newsFlashStorageKey);

  return flashMessage === 'createSuccess' || flashMessage === 'deleteSuccess' ? flashMessage : null;
};

const formatDate = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatDateTimeInEditorTimeZone(value) ?? value;
};

const firstBlockSummary = (item: NewsContentItem) => {
  const firstBlock = item.contentBlocks?.[0];
  return firstBlock?.intro ?? firstBlock?.body ?? item.payload.teaser ?? '';
};

const categorySummary = (item: NewsContentItem) =>
  item.categories?.map((category) => category.name).join(', ') ?? item.payload.category ?? '—';

const readPaginationValue = (key: 'page' | 'pageSize', fallback: number) => {
  const search = typeof globalThis.window === 'undefined' ? '' : globalThis.window.location.search;
  const rawValue = new URLSearchParams(search).get(key);
  if (!rawValue) {
    return fallback;
  }
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

export const NewsListPage = () => {
  const pt = React.useCallback<PluginTranslator>(
    (key, variables) => translatePluginKey('news', key, variables),
    []
  );
  const navigate = useNavigate();
  const createLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.create);
  const editLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.edit);
  const pagination = {
    page: readPaginationValue('page', 1),
    pageSize: readPaginationValue('pageSize', 25),
  };
  const [result, setResult] = React.useState<NewsListResult>({
    data: [],
    pagination: { ...pagination, hasNextPage: false },
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
    void listNews(pagination)
      .then((nextResult) => {
        if (active) {
          setResult(nextResult);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(resolveNewsErrorMessage(pt, loadError, 'messages.loadError'));
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
  }, [pagination.page, pagination.pageSize, pt]);

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
                id: 'categories',
                header: pt('fields.categories'),
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

type NewsCreatePageProps = Readonly<{
  initialAuthor?: string;
}>;

export const NewsCreatePage = ({ initialAuthor }: NewsCreatePageProps) => (
  <NewsDetailPage mode="create" initialAuthor={initialAuthor} />
);

export const NewsEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  const contentId = resolveNewsContentId(params);

  return <NewsDetailPage mode="edit" contentId={contentId} />;
};

const resolveNewsContentId = (params: {
  readonly contentId?: string;
  readonly id?: string;
}): string | undefined => {
  if (typeof params.contentId === 'string') {
    return params.contentId;
  }

  return typeof params.id === 'string' ? params.id : undefined;
};
