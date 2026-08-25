import { IconExternalLink, IconHelpCircle, IconX } from '@tabler/icons-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { t } from '../i18n';

type DocumentationResponse = Readonly<{
  id: string;
  markdown: string;
  documentationBaseUrl: string;
  websiteUrl: string;
}>;

type LoadState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'ready'; payload: DocumentationResponse }>
  | Readonly<{ kind: 'error' }>;

const loadDocumentation = async (pageId: string): Promise<DocumentationResponse> => {
  const response = await fetch(`/api/studio/documentation/${encodeURIComponent(pageId)}`, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('documentation_unavailable');
  }
  const value = (await response.json()) as Partial<DocumentationResponse>;
  if (
    value.id !== pageId ||
    typeof value.markdown !== 'string' ||
    typeof value.documentationBaseUrl !== 'string' ||
    typeof value.websiteUrl !== 'string'
  ) {
    throw new Error('documentation_invalid');
  }
  return value as DocumentationResponse;
};

const resolveLink = (value: string | undefined, websiteUrl: string): string | undefined => {
  if (!value) return undefined;
  try {
    const resolved = new URL(value, websiteUrl);
    return resolved.protocol === 'https:' || resolved.protocol === 'mailto:'
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const resolveImage = (
  value: string | undefined,
  websiteUrl: string,
  documentationBaseUrl: string
): string | undefined => {
  if (!value) return undefined;
  try {
    const resolved = new URL(value, websiteUrl);
    const baseUrl = new URL(documentationBaseUrl);
    return resolved.protocol === 'https:' &&
      resolved.origin === baseUrl.origin &&
      resolved.pathname.startsWith(baseUrl.pathname)
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const DocumentationMarkdown = ({ payload }: Readonly<{ payload: DocumentationResponse }>) => (
  <article className="space-y-4 text-sm leading-7 text-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ children }) => <h2>{children}</h2>,
        h2: ({ children }) => <h3>{children}</h3>,
        h3: ({ children }) => <h4>{children}</h4>,
        a: ({ href, children }) => {
          const safeHref = resolveLink(href, payload.websiteUrl);
          return safeHref ? (
            <a href={safeHref} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ) : (
            <span>{children}</span>
          );
        },
        img: ({ src, alt }) => {
          const safeSrc = resolveImage(
            src,
            payload.websiteUrl,
            payload.documentationBaseUrl
          );
          return safeSrc ? <img src={safeSrc} alt={alt ?? ''} loading="lazy" /> : null;
        },
      }}
    >
      {payload.markdown}
    </ReactMarkdown>
  </article>
);

export const ContextualHelp = ({ pageId }: Readonly<{ pageId: string }>) => {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<LoadState>({ kind: 'idle' });
  const requestIdRef = React.useRef(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      globalThis.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, []);

  const load = React.useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState({ kind: 'loading' });
    void loadDocumentation(pageId)
      .then((payload) => {
        if (requestIdRef.current === requestId) setState({ kind: 'ready', payload });
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setState({ kind: 'error' });
      });
  }, [pageId]);

  React.useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    []
  );

  React.useEffect(() => {
    if (!open || state.kind !== 'idle') return;
    load();
  }, [load, open, state.kind]);

  return (
    <>
      <Alert className="flex flex-col gap-3 border-primary/30 bg-primary/5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AlertTitle className="flex items-center gap-2">
            <IconHelpCircle aria-hidden="true" className="size-5" />
            {t('shell.contextualHelp.hintTitle')}
          </AlertTitle>
          <AlertDescription>{t('shell.contextualHelp.hintDescription')}</AlertDescription>
        </div>
        <Button
          ref={triggerRef}
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
        >
          {t('shell.contextualHelp.open')}
        </Button>
      </Alert>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[92dvh] max-w-4xl flex-col p-0 sm:w-[calc(100%-2rem)]">
          <DialogHeader className="border-b border-border px-6 py-5 pr-14">
            <DialogTitle asChild>
              <h1>{t('shell.contextualHelp.title')}</h1>
            </DialogTitle>
            <DialogDescription>{t('shell.contextualHelp.description')}</DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              type="button"
              variant="tertiary"
              size="icon"
              className="absolute right-4 top-4"
              aria-label={t('shell.contextualHelp.close')}
            >
              <IconX aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
          <div className="min-h-48 overflow-y-auto px-6 py-5" aria-live="polite">
            {state.kind === 'idle' || state.kind === 'loading' ? (
              <p role="status">{t('shell.contextualHelp.loading')}</p>
            ) : state.kind === 'error' ? (
              <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
                <AlertTitle>{t('shell.contextualHelp.errorTitle')}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{t('shell.contextualHelp.errorDescription')}</p>
                  <Button type="button" variant="secondary" onClick={load}>
                    {t('shell.contextualHelp.retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : state.payload.markdown.trim() === '' ? (
              <p>{t('shell.contextualHelp.empty')}</p>
            ) : (
              <DocumentationMarkdown payload={state.payload} />
            )}
          </div>
          {state.kind === 'ready' ? (
            <div className="border-t border-border px-6 py-4">
              <Button asChild variant="secondary">
                <a href={state.payload.websiteUrl} target="_blank" rel="noopener noreferrer">
                  {t('shell.contextualHelp.openWebsite')}
                  <IconExternalLink aria-hidden="true" className="size-4" />
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
