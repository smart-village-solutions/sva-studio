/** Published Studio releases, independent of the currently deployed version. */
import { Button, StudioPageTitle } from '@sva/studio-ui-react';
import { useLoaderData } from '@tanstack/react-router';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { t } from '../i18n';
import {
  STUDIO_RELEASES_URL,
  studioReleaseNotesSchema,
  type StudioReleaseNotes,
} from '../lib/studio-release-notes.shared';
import { useLocale } from '../providers/locale-provider';
import type { RootLoaderData } from './__root';

type LoadState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; releases: StudioReleaseNotes };

const safeLink = (href: string | undefined, base: string): string | undefined => {
  if (!href) return undefined;
  try {
    const url = new URL(href, base);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

const ReleaseEntry = ({
  release,
  locale,
}: Readonly<{ release: StudioReleaseNotes[number]; locale: string }>) => {
  const sourceUrl = `${STUDIO_RELEASES_URL}/tag/${encodeURIComponent(release.tag)}`;
  return (
    <article
      aria-labelledby={`release-${release.tag}`}
      className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={`release-${release.tag}`} className="text-xl font-semibold">
            {release.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {release.tag} ·{' '}
            <time dateTime={release.publishedAt}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'long',
                timeZone: 'UTC',
              }).format(new Date(release.publishedAt))}
            </time>
          </p>
        </div>
        <a
          className="text-sm font-medium text-primary underline"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('shell.changelog.source')}
        </a>
      </header>
      {release.body ? (
        <div className="space-y-3 break-words text-sm leading-7 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h3]:pt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:pt-2 [&_h4]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc">
          <ReactMarkdown
            skipHtml
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h3>{children}</h3>,
              h2: ({ children }) => <h3>{children}</h3>,
              h3: ({ children }) => <h4>{children}</h4>,
              a: ({ href, children }) => {
                const safeHref = safeLink(href, sourceUrl);
                return safeHref ? (
                  <a href={safeHref} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ) : (
                  <span>{children}</span>
                );
              },
              img: () => null,
            }}
          >
            {release.body}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('shell.changelog.noNotes')}</p>
      )}
    </article>
  );
};

export const ChangelogPage = ({
  initialReleases,
}: Readonly<{ initialReleases?: StudioReleaseNotes }>) => {
  const { locale } = useLocale();
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<LoadState>(() =>
    initialReleases ? { kind: 'ready', releases: initialReleases } : { kind: 'loading' }
  );
  React.useEffect(() => {
    if (initialReleases) return;
    const controller = new AbortController();
    setState({ kind: 'loading' });
    void fetch('/api/studio/releases', { signal: controller.signal, credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('release_notes_unavailable');
        const releases = studioReleaseNotesSchema.parse(await response.json());
        if (!controller.signal.aborted) setState({ kind: 'ready', releases });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, [attempt, initialReleases]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <StudioPageTitle>{t('shell.changelog.title')}</StudioPageTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t('shell.changelog.description')}
        </p>
        <a
          className="text-sm font-medium text-primary underline"
          href={STUDIO_RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('shell.changelog.archive')}
        </a>
      </header>
      {state.kind === 'loading' ? <p role="status">{t('shell.changelog.loading')}</p> : null}
      {state.kind === 'error' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <p role="alert">{t('shell.changelog.error')}</p>
          <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
            {t('shell.changelog.retry')}
          </Button>
        </div>
      ) : null}
      {state.kind === 'ready' && state.releases.length === 0 ? (
        <p role="status">{t('shell.changelog.empty')}</p>
      ) : null}
      {state.kind === 'ready'
        ? state.releases.map((release) => (
            <ReleaseEntry key={release.tag} release={release} locale={locale} />
          ))
        : null}
    </section>
  );
};

export const ChangelogRoutePage = () => {
  const initialReleases = useLoaderData({
    from: '__root__',
    select: (data) => (data as RootLoaderData | undefined)?.changelogReleases,
  });
  return <ChangelogPage initialReleases={initialReleases} />;
};
