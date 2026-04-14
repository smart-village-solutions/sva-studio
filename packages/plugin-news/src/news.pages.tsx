import React from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { translatePluginKey, usePluginTranslation } from '@sva/sdk';

import { createNews, deleteNews, getNews, listNews, updateNews, type NewsFormInput } from './news.api.js';
import type { NewsContentItem, NewsPayload, NewsStatus } from './news.types.js';
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
  status: 'draft',
  payload: defaultPayload(),
});

const inputClassName =
  'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground';

const buttonClassName =
  'inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50';

const secondaryButtonClassName =
  'inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground';

const newsFlashStorageKey = 'news-plugin-flash-message';

const flashMessageTranslationKeys: Record<FlashMessageCode, `messages.${FlashMessageCode}`> = {
  createSuccess: 'messages.createSuccess',
  deleteSuccess: 'messages.deleteSuccess',
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

const fromDatetimeLocalValue = (value: string): string | undefined => {
  if (value.length === 0) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
          status: item.status,
          publishedAt: item.publishedAt,
          payload: item.payload,
        });
      })
      .catch(() => {
        if (active) {
          setStatusMessage({ kind: 'error', text: pt('messages.loadError') });
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
    const validationErrors = validateNewsPayload(form.payload);
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
    } catch {
      setStatusMessage({ kind: 'error', text: pt('messages.saveError') });
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
    } catch {
      setStatusMessage({ kind: 'error', text: pt('messages.deleteError') });
    } finally {
      setDeletePending(false);
    }
  };

  if (isLoading) {
    return <p role="status">{pt('messages.loading')}</p>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">
          {mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
        </p>
      </header>

      {statusMessage ? (
        <p role="status" aria-live="polite" className={statusMessage.kind === 'error' ? 'text-destructive' : 'text-primary'}>
          {statusMessage.text}
        </p>
      ) : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <label htmlFor="news-title" className="text-sm font-medium">
            {pt('fields.title')}
          </label>
          <input
            id="news-title"
            className={inputClassName}
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="news-teaser" className="text-sm font-medium">
            {pt('fields.teaser')}
          </label>
          <textarea
            id="news-teaser"
            className={inputClassName}
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
          <p id="news-teaser-help" className="mt-1 text-xs text-muted-foreground">
            {pt('fields.teaserHelp')}
          </p>
          {hasFieldError('teaser') ? (
            <p id="news-teaser-error" className="mt-1 text-xs text-destructive">
              {pt('validation.teaser')}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="news-body" className="text-sm font-medium">
            {pt('fields.body')}
          </label>
          <textarea
            id="news-body"
            className={`${inputClassName} min-h-48`}
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
          {hasFieldError('body') ? (
            <p id="news-body-error" className="mt-1 text-xs text-destructive">
              {pt('validation.body')}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="news-image-url" className="text-sm font-medium">
              {pt('fields.imageUrl')}
            </label>
            <input
              id="news-image-url"
              className={inputClassName}
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
            {hasFieldError('imageUrl') ? (
              <p id="news-image-url-error" className="mt-1 text-xs text-destructive">
                {pt('validation.imageUrl')}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="news-external-url" className="text-sm font-medium">
              {pt('fields.externalUrl')}
            </label>
            <input
              id="news-external-url"
              className={inputClassName}
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
            {hasFieldError('externalUrl') ? (
              <p id="news-external-url-error" className="mt-1 text-xs text-destructive">
                {pt('validation.externalUrl')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="news-category" className="text-sm font-medium">
              {pt('fields.category')}
            </label>
            <input
              id="news-category"
              className={inputClassName}
              value={form.payload.category ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payload: { ...current.payload, category: event.target.value || undefined },
                }))
              }
            />
          </div>

          <div>
            <label htmlFor="news-status" className="text-sm font-medium">
              {pt('fields.status')}
            </label>
            <select
              id="news-status"
              className={inputClassName}
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as NewsStatus,
                }))
              }
            >
              <option value="draft">{pt('status.draft')}</option>
              <option value="in_review">{pt('status.inReview')}</option>
              <option value="approved">{pt('status.approved')}</option>
              <option value="published">{pt('status.published')}</option>
              <option value="archived">{pt('status.archived')}</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="news-published-at" className="text-sm font-medium">
            {pt('fields.publishedAt')}
          </label>
          <input
            id="news-published-at"
            className={inputClassName}
            type="datetime-local"
            value={toDatetimeLocalValue(form.publishedAt)}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                publishedAt: fromDatetimeLocalValue(event.target.value),
              }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={buttonClassName} type="submit">
            {mode === 'create' ? pt('actions.create') : pt('actions.save')}
          </button>
          <Link to="/plugins/news" className={secondaryButtonClassName}>
            {pt('actions.back')}
          </Link>
          {mode === 'edit' ? (
            <button className={secondaryButtonClassName} type="button" onClick={onDelete} disabled={deletePending}>
              {pt('actions.delete')}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
};

export const NewsListPage = () => {
  const pt = usePluginTranslation('news');
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
      .catch(() => {
        if (active) {
          setError(translatePluginKey('news', 'messages.loadError'));
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
    return <p role="status">{pt('messages.loading')}</p>;
  }

  if (error) {
    return <p role="status" aria-live="polite" className="text-destructive">{error}</p>;
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{pt('list.title')}</h1>
          <p className="text-sm text-muted-foreground">{pt('list.description')}</p>
        </div>
        <Link to="/plugins/news/new" className={buttonClassName}>
          {pt('actions.create')}
        </Link>
      </header>

      {flashMessage ? (
        <p role="status" aria-live="polite" className="text-primary">
          {pt(flashMessageTranslationKeys[flashMessage])}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div role="status" aria-live="polite" className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium">{pt('empty.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pt('empty.description')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{pt('list.title')}</caption>
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{pt('fields.title')}</th>
                <th className="px-4 py-3">{pt('fields.status')}</th>
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
                  <td className="px-4 py-3">{pt(`status.${item.status === 'in_review' ? 'inReview' : item.status}`)}</td>
                  <td className="px-4 py-3">{item.payload.category ?? '—'}</td>
                  <td className="px-4 py-3">{formatDate(item.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <Link to="/plugins/news/$contentId" params={{ contentId: item.id }} className={secondaryButtonClassName}>
                      {pt('actions.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export const NewsCreatePage = () => <NewsForm mode="create" />;

export const NewsEditPage = () => {
  const params = useParams({ strict: false });
  const contentId = typeof params.contentId === 'string' ? params.contentId : undefined;

  return <NewsForm mode="edit" contentId={contentId} />;
};
