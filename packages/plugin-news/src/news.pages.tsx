import React from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { translatePluginKey, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFieldGroup,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  Textarea,
} from '@sva/studio-ui-react';

import { NewsApiError, createNews, deleteNews, getNews, listNews, updateNews, type NewsFormInput } from './news.api.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds } from './plugin.js';
import type { NewsContentItem, NewsPayload } from './news.types.js';
import { validateNewsPayload } from './news.validation.js';

type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

type FlashMessageCode = 'createSuccess' | 'deleteSuccess';

const defaultPayload = (): NewsPayload => ({
  teaser: '',
  body: '',
});

const defaultForm = (): NewsFormInput => ({
  title: '',
  publishedAt: '',
  payload: defaultPayload(),
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
        if (!active) {
          return;
        }

        setForm({
          title: item.title,
          publishedAt: item.publishedAt,
          payload: item.payload,
        });
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

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = [...validateNewsPayload(form.payload), ...(form.publishedAt ? [] : ['publishedAt'])];
    setFieldErrors(validationErrors);

    if (validationErrors.length > 0) {
      setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
      return;
    }

    try {
      if (mode === 'create') {
        await createNews(form);
        persistFlashMessage('createSuccess');
        await navigate({ to: '/plugins/news' });
        return;
      }

      if (contentId) {
        await updateNews(contentId, form);
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
      await navigate({ to: '/plugins/news' });
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
      {statusMessage ? (
        <StudioFormSummary kind={statusMessage.kind}>{statusMessage.text}</StudioFormSummary>
      ) : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <StudioField id="news-title" label={pt('fields.title')} required>
          <Input
            id="news-title"
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </StudioField>

        <StudioField
          id="news-teaser"
          label={pt('fields.teaser')}
          description={pt('fields.teaserHelp')}
          descriptionId="news-teaser-help"
          error={hasFieldError('teaser') ? pt('validation.teaser') : undefined}
          errorId="news-teaser-error"
          required
        >
          <Textarea
            id="news-teaser"
            required
            aria-describedby={buildDescribedBy('news-teaser-help', hasFieldError('teaser') && 'news-teaser-error')}
            aria-invalid={hasFieldError('teaser') || undefined}
            value={form.payload.teaser}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                payload: { ...current.payload, teaser: event.target.value },
              }))
            }
          />
        </StudioField>

        <StudioField
          id="news-body"
          label={pt('fields.body')}
          error={hasFieldError('body') ? pt('validation.body') : undefined}
          errorId="news-body-error"
          required
        >
          <Textarea
            id="news-body"
            className="min-h-48"
            required
            aria-describedby={buildDescribedBy(hasFieldError('body') && 'news-body-error')}
            aria-invalid={hasFieldError('body') || undefined}
            value={form.payload.body}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                payload: { ...current.payload, body: event.target.value },
              }))
            }
          />
        </StudioField>

        <StudioFieldGroup columns={2}>
          <StudioField
            id="news-image-url"
            label={pt('fields.imageUrl')}
            error={hasFieldError('imageUrl') ? pt('validation.imageUrl') : undefined}
            errorId="news-image-url-error"
          >
            <Input
              id="news-image-url"
              type="url"
              aria-describedby={buildDescribedBy(hasFieldError('imageUrl') && 'news-image-url-error')}
              aria-invalid={hasFieldError('imageUrl') || undefined}
              value={form.payload.imageUrl ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payload: { ...current.payload, imageUrl: event.target.value || undefined },
                }))
              }
            />
          </StudioField>

          <StudioField
            id="news-external-url"
            label={pt('fields.externalUrl')}
            error={hasFieldError('externalUrl') ? pt('validation.externalUrl') : undefined}
            errorId="news-external-url-error"
          >
            <Input
              id="news-external-url"
              type="url"
              aria-describedby={buildDescribedBy(hasFieldError('externalUrl') && 'news-external-url-error')}
              aria-invalid={hasFieldError('externalUrl') || undefined}
              value={form.payload.externalUrl ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payload: { ...current.payload, externalUrl: event.target.value || undefined },
                }))
              }
            />
          </StudioField>
        </StudioFieldGroup>

        <StudioFieldGroup columns={2}>
          <StudioField id="news-category" label={pt('fields.category')}>
            <Input
              id="news-category"
              value={form.payload.category ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payload: { ...current.payload, category: event.target.value || undefined },
                }))
              }
            />
          </StudioField>
        </StudioFieldGroup>

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
              setForm((current) => ({
                ...current,
                publishedAt: fromDatetimeLocalValue(event.target.value),
              }))
            }
          />
        </StudioField>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">{submitLabel}</Button>
          <Button asChild variant="outline">
            <Link to="/plugins/news">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' ? (
            <Button variant="destructive" type="button" onClick={onDelete} disabled={deletePending}>
              {deleteLabel}
            </Button>
          ) : null}
        </div>
      </form>
    </StudioDetailPageTemplate>
  );
};

export const NewsListPage = () => {
  const pt = usePluginTranslation('news');
  const createLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.create);
  const editLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.edit);
  const [items, setItems] = React.useState<readonly NewsContentItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [flashMessage, setFlashMessage] = React.useState<FlashMessageCode | null>(null);

  React.useEffect(() => {
    setFlashMessage(consumeFlashMessage());
  }, []);

  React.useEffect(() => {
    let active = true;

    void listNews()
      .then((response) => {
        if (active) {
          setItems(response);
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
  }, []);

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
          <Link to="/plugins/news/new">{createLabel}</Link>
        </Button>
      }
    >

      {flashMessage ? (
        <StudioFormSummary kind="success">{pt(flashMessageTranslationKeys[flashMessage])}</StudioFormSummary>
      ) : null}

      {items.length === 0 ? (
        <StudioEmptyState>
          <h2 className="text-lg font-medium">{pt('empty.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pt('empty.description')}</p>
        </StudioEmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{pt('list.title')}</caption>
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{pt('fields.title')}</th>
                <th className="px-4 py-3">{pt('fields.category')}</th>
                <th className="px-4 py-3">{pt('fields.updatedAt')}</th>
                <th className="px-4 py-3">{pt('fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.payload.teaser}</div>
                  </td>
                  <td className="px-4 py-3">{item.payload.category ?? '—'}</td>
                  <td className="px-4 py-3">{formatDate(item.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/plugins/news/$contentId" params={{ contentId: item.id }}>
                        {editLabel}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StudioOverviewPageTemplate>
  );
};

export const NewsCreatePage = () => <NewsForm mode="create" />;

export const NewsEditPage = () => {
  const params = useParams({ strict: false });
  const contentId = typeof params.contentId === 'string' ? params.contentId : undefined;

  return <NewsForm mode="edit" contentId={contentId} />;
};
