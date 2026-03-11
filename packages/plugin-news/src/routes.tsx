import type { RouteFactory } from '@sva/sdk';
import type { AnyRoute, RootRoute } from '@tanstack/react-router';
import { createRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import React from 'react';

import { newsStore } from './store';
import type { NewsArticle } from './types';

/* -------------------------------------------------------------------------- */
/*  Status-Badge                                                              */
/* -------------------------------------------------------------------------- */

const statusLabel: Record<NewsArticle['status'], string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  archived: 'Archiviert',
};

const statusClass: Record<NewsArticle['status'], string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const StatusBadge = ({ status }: { status: NewsArticle['status'] }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass[status]}`}>
    {statusLabel[status]}
  </span>
);

/* -------------------------------------------------------------------------- */
/*  News-Übersicht                                                            */
/* -------------------------------------------------------------------------- */

const NewsListPage = () => {
  const [articles, setArticles] = React.useState<NewsArticle[]>(() => newsStore.getAll());

  const handleDelete = (id: string) => {
    if (!globalThis.confirm('Diesen Beitrag wirklich löschen?')) return;
    newsStore.delete(id);
    setArticles(newsStore.getAll());
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">News</h1>
          <p className="mt-1 text-sm text-muted-foreground">Beiträge erstellen, bearbeiten und verwalten.</p>
        </div>
        <Link
          to="/plugins/news/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Neuer Beitrag
        </Link>
      </div>

      {articles.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Noch keine Beiträge vorhanden.</p>
          <Link
            to="/plugins/news/new"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Ersten Beitrag erstellen
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {articles.map((article) => (
            <div
              key={article.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Link
                    to="/plugins/news/$articleId"
                    params={{ articleId: article.id }}
                    className="truncate text-base font-semibold text-foreground hover:underline"
                  >
                    {article.title}
                  </Link>
                  <StatusBadge status={article.status} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{article.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {article.author} · {formatDate(article.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  to="/plugins/news/$articleId"
                  params={{ articleId: article.id }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="Bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  title="Löschen"
                  onClick={() => handleDelete(article.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  News erstellen / bearbeiten                                               */
/* -------------------------------------------------------------------------- */

type FormData = {
  title: string;
  summary: string;
  content: string;
  author: string;
  status: NewsArticle['status'];
};

const emptyForm: FormData = { title: '', summary: '', content: '', author: '', status: 'draft' };

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const NewsEditorPage = ({ mode }: { mode: 'create' | 'edit' }) => {
  const navigate = useNavigate();
  const params = mode === 'edit' ? (useParams({ from: '/plugins/news/$articleId' }) as { articleId: string }) : null;
  const existing = params ? newsStore.getById(params.articleId) : null;

  const [form, setForm] = React.useState<FormData>(() => {
    if (existing) {
      return {
        title: existing.title,
        summary: existing.summary,
        content: existing.content,
        author: existing.author,
        status: existing.status,
      };
    }
    return { ...emptyForm };
  });

  const [error, setError] = React.useState<string | null>(null);

  if (mode === 'edit' && !existing) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-center">
        <p className="text-muted-foreground">Beitrag nicht gefunden.</p>
        <Link to="/plugins/news" className="mt-4 inline-block text-sm text-primary hover:underline">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Bitte einen Titel eingeben.');
      return;
    }
    if (!form.author.trim()) {
      setError('Bitte einen Autor angeben.');
      return;
    }

    if (mode === 'edit' && params) {
      newsStore.update(params.articleId, {
        title: form.title,
        summary: form.summary,
        content: form.content,
        status: form.status,
      });
    } else {
      newsStore.create({
        title: form.title,
        summary: form.summary,
        content: form.content,
        author: form.author,
      });
    }

    void navigate({ to: '/plugins/news' });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/plugins/news"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {mode === 'edit' ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div>
          <label htmlFor="news-title" className="mb-1.5 block text-sm font-medium text-foreground">
            Titel *
          </label>
          <input
            id="news-title"
            type="text"
            className={inputClass}
            placeholder="Titel des Beitrags"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="news-author" className="mb-1.5 block text-sm font-medium text-foreground">
            Autor *
          </label>
          <input
            id="news-author"
            type="text"
            className={inputClass}
            placeholder="Name des Autors"
            value={form.author}
            readOnly={mode === 'edit'}
            onChange={(e) => update('author', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="news-summary" className="mb-1.5 block text-sm font-medium text-foreground">
            Zusammenfassung
          </label>
          <input
            id="news-summary"
            type="text"
            className={inputClass}
            placeholder="Kurzbeschreibung für die Übersicht"
            value={form.summary}
            onChange={(e) => update('summary', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="news-content" className="mb-1.5 block text-sm font-medium text-foreground">
            Inhalt
          </label>
          <textarea
            id="news-content"
            rows={10}
            className={inputClass}
            placeholder="Beitragstext …"
            value={form.content}
            onChange={(e) => update('content', e.target.value)}
          />
        </div>

        {mode === 'edit' ? (
          <div>
            <label htmlFor="news-status" className="mb-1.5 block text-sm font-medium text-foreground">
              Status
            </label>
            <select
              id="news-status"
              className={inputClass}
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
            >
              <option value="draft">Entwurf</option>
              <option value="published">Veröffentlicht</option>
              <option value="archived">Archiviert</option>
            </select>
          </div>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            {mode === 'edit' ? 'Speichern' : 'Erstellen'}
          </button>
          <Link
            to="/plugins/news"
            className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Route-Factories                                                           */
/* -------------------------------------------------------------------------- */

type PluginRouteFactory = RouteFactory<RootRoute, AnyRoute>;

export const pluginNewsRoutes: PluginRouteFactory[] = [
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/plugins/news',
      component: NewsListPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/plugins/news/new',
      component: () => <NewsEditorPage mode="create" />,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/plugins/news/$articleId',
      component: () => <NewsEditorPage mode="edit" />,
    }),
];
