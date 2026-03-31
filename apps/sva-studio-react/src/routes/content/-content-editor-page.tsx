import { Link, useNavigate } from '@tanstack/react-router';
import { GENERIC_CONTENT_TYPE, withServerDeniedContentAccess, type IamContentAccessSummary, type IamContentStatus } from '@sva/core';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useContentAccess } from '../../hooks/use-content-access';
import { useContentDetail, useCreateContent } from '../../hooks/use-contents';
import { t } from '../../i18n';
import type { CreateContentPayload, IamHttpError, UpdateContentPayload } from '../../lib/iam-api';

type ContentEditorPageProps = {
  readonly mode: 'create' | 'edit';
  readonly contentId?: string;
};

type ContentFormState = {
  title: string;
  contentType: string;
  status: IamContentStatus;
  publishedAt: string;
  payloadText: string;
};

const emptyFormState = (): ContentFormState => ({
  title: '',
  contentType: GENERIC_CONTENT_TYPE,
  status: 'draft',
  publishedAt: '',
  payloadText: '{}',
});

const toDateTimeInputValue = (value?: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (entry: number) => String(entry).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoDateTime = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('content.table.notPublished');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const contentErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('content.messages.saveError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('content.errors.forbidden');
    case 'csrf_validation_failed':
      return t('content.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('content.errors.rateLimited');
    case 'not_found':
      return t('content.errors.notFound');
    case 'database_unavailable':
      return t('content.errors.databaseUnavailable');
    case 'invalid_request':
      return error.message && error.message !== `http_${error.status}`
        ? error.message
        : t('content.errors.invalidRequest');
    default:
      return t('content.messages.saveError');
  }
};

const statusVariantByValue = {
  draft: 'outline',
  in_review: 'secondary',
  approved: 'default',
  published: 'default',
  archived: 'destructive',
} as const;

const statusLabelKeyByValue = {
  draft: 'content.status.draft',
  in_review: 'content.status.inReview',
  approved: 'content.status.approved',
  published: 'content.status.published',
  archived: 'content.status.archived',
} as const;

const contentAccessLabelKeyByState = {
  editable: 'content.access.states.editable',
  read_only: 'content.access.states.readOnly',
  blocked: 'content.access.states.blocked',
  server_denied: 'content.access.states.serverDenied',
} as const;

const buildFormState = (content: {
  title: string;
  contentType: string;
  status: IamContentStatus;
  publishedAt?: string;
  payload: unknown;
}): ContentFormState => ({
  title: content.title,
  contentType: content.contentType,
  status: content.status,
  publishedAt: toDateTimeInputValue(content.publishedAt),
  payloadText: JSON.stringify(content.payload, null, 2),
});

const historyActionLabelKey = {
  created: 'content.history.actions.created',
  updated: 'content.history.actions.updated',
  status_changed: 'content.history.actions.statusChanged',
} as const;

const parseContentPayload = (payloadText: string): { ok: true; payload: unknown } | { ok: false; message: string } => {
  try {
    return { ok: true, payload: JSON.parse(payloadText) };
  } catch {
    return { ok: false, message: t('content.validation.payloadJsonInvalid') };
  }
};

const renderContentMeta = ({
  mode,
  content,
  access,
}: {
  mode: ContentEditorPageProps['mode'];
  content: ReturnType<typeof useContentDetail>['content'];
  access: IamContentAccessSummary | null;
}) => {
  if (mode === 'create') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('content.meta.createHint')}</p>
        {access ? <p className="text-xs text-muted-foreground">{t('content.meta.accessContext', { value: access.organizationIds.join(', ') || '—' })}</p> : null}
      </div>
    );
  }

  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-muted-foreground">{t('content.meta.author')}</dt>
        <dd className="text-foreground">{content?.author}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('content.meta.createdAt')}</dt>
        <dd className="text-foreground">{formatDateTime(content?.createdAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('content.meta.updatedAt')}</dt>
        <dd className="text-foreground">{formatDateTime(content?.updatedAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('content.meta.id')}</dt>
        <dd className="break-all text-foreground">{content?.id}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('content.meta.access')}</dt>
        <dd className="text-foreground">{access ? t(contentAccessLabelKeyByState[access.state]) : '—'}</dd>
      </div>
    </dl>
  );
};

const renderContentHistory = ({
  mode,
  history,
}: {
  mode: ContentEditorPageProps['mode'];
  history: ReturnType<typeof useContentDetail>['history'];
}) => {
  if (mode === 'create') {
    return <p className="text-sm text-muted-foreground">{t('content.history.createHint')}</p>;
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('content.history.empty')}</p>;
  }

  return (
    <ol className="space-y-3">
      {history.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{t(historyActionLabelKey[entry.action])}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('content.history.byline', { actor: entry.actor })}</p>
          {entry.summary ? <p className="mt-2 text-sm text-foreground">{entry.summary}</p> : null}
          {entry.changedFields.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('content.history.changedFields', { fields: entry.changedFields.join(', ') })}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
};

export const ContentEditorPage = ({ mode, contentId }: ContentEditorPageProps) => {
  const navigate = useNavigate();
  const createApi = useCreateContent();
  const detailApi = useContentDetail(mode === 'edit' ? (contentId ?? null) : null);
  const contentAccessApi = useContentAccess();
  const [formState, setFormState] = React.useState<ContentFormState>(emptyFormState);
  const [payloadError, setPayloadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode === 'edit' && detailApi.content) {
      setFormState(buildFormState(detailApi.content));
      setPayloadError(null);
    }
  }, [detailApi.content, mode]);

  const activeError = mode === 'create' ? createApi.mutationError : detailApi.mutationError;
  const isLoading = mode === 'create' ? false : detailApi.isLoading;
  const content = detailApi.content;
  const activeAccess =
    mode === 'edit'
      ? content?.access ?? (detailApi.error?.code === 'forbidden' ? withServerDeniedContentAccess(undefined) : null)
      : contentAccessApi.access ?? (activeError?.code === 'forbidden' ? withServerDeniedContentAccess(undefined) : null);
  const isReadOnly = mode === 'edit' && activeAccess?.canRead === true && activeAccess.canUpdate === false;
  const actionsDisabled =
    mode === 'create' ? (activeAccess ? !activeAccess.canCreate : activeError?.code === 'forbidden') : !activeAccess?.canUpdate;

  const submitForm = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actionsDisabled) {
      return;
    }
    setPayloadError(null);

    const parsedPayload = parseContentPayload(formState.payloadText);
    if (!parsedPayload.ok) {
      setPayloadError(parsedPayload.message);
      return;
    }

    const publishedAt = toIsoDateTime(formState.publishedAt);
    if (formState.status === 'published' && !publishedAt) {
      setPayloadError(t('content.validation.publishedAtRequired'));
      return;
    }

    if (mode === 'create') {
      const payload: CreateContentPayload = {
        title: formState.title.trim(),
        contentType: formState.contentType,
        status: formState.status,
        publishedAt,
        payload: parsedPayload.payload as CreateContentPayload['payload'],
      };

      const success = await createApi.createContent(payload);
      if (!success) {
        return;
      }

      await navigate({ to: '/content' });
      return;
    }

    if (!contentId) {
      return;
    }

    const payload: UpdateContentPayload = {
      title: formState.title.trim(),
      status: formState.status,
      publishedAt,
      payload: parsedPayload.payload as UpdateContentPayload['payload'],
    };

    await detailApi.updateContent(payload);
  };

  return (
    <section className="space-y-5" aria-busy={isLoading}>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-foreground">
              {mode === 'create' ? t('content.editor.createTitle') : t('content.editor.editTitle')}
            </h1>
            {content ? (
              <Badge variant={statusVariantByValue[content.status]}>{t(statusLabelKeyByValue[content.status])}</Badge>
            ) : null}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {mode === 'create' ? t('content.editor.createSubtitle') : t('content.editor.editSubtitle')}
          </p>
          {isReadOnly ? (
            <p className="text-sm text-muted-foreground">{t('content.messages.readOnly')}</p>
          ) : actionsDisabled ? (
            <p className="text-sm text-muted-foreground">{t('content.messages.actionsDisabled')}</p>
          ) : null}
        </div>
        <Button asChild variant="outline">
          <Link to="/content">{t('content.actions.back')}</Link>
        </Button>
      </header>

      {detailApi.error && mode === 'edit' ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(detailApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      {activeError || payloadError ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{payloadError ?? contentErrorMessage(activeError)}</AlertDescription>
        </Alert>
      ) : null}

      {isReadOnly ? (
        <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
          <AlertDescription>{t('content.messages.readOnly')}</AlertDescription>
        </Alert>
      ) : null}

      {mode === 'edit' && !content && !detailApi.isLoading ? null : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card className="p-5">
            <form className="space-y-4" onSubmit={submitForm}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="content-title">{t('content.fields.title')}</Label>
                  <Input
                    id="content-title"
                    value={formState.title}
                    disabled={actionsDisabled}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="content-type">{t('content.fields.contentType')}</Label>
                  <Input id="content-type" value={formState.contentType} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="content-status">{t('content.fields.status')}</Label>
                  <Select
                    id="content-status"
                    value={formState.status}
                    disabled={actionsDisabled}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, status: event.target.value as IamContentStatus }))
                    }
                  >
                    <option value="draft">{t('content.status.draft')}</option>
                    <option value="in_review">{t('content.status.inReview')}</option>
                    <option value="approved">{t('content.status.approved')}</option>
                    <option value="published">{t('content.status.published')}</option>
                    <option value="archived">{t('content.status.archived')}</option>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="content-published-at">{t('content.fields.publishedAt')}</Label>
                  <Input
                    id="content-published-at"
                    type="datetime-local"
                    value={formState.publishedAt}
                    disabled={actionsDisabled}
                    required={formState.status === 'published'}
                    onChange={(event) => setFormState((current) => ({ ...current, publishedAt: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="content-payload">{t('content.fields.payload')}</Label>
                  <Textarea
                    id="content-payload"
                    value={formState.payloadText}
                    disabled={actionsDisabled}
                    className="min-h-[22rem] font-mono text-xs"
                    onChange={(event) => setFormState((current) => ({ ...current, payloadText: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={actionsDisabled}>
                  {mode === 'create' ? t('content.actions.createNow') : t('content.actions.save')}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/content">{t('content.actions.cancel')}</Link>
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-5">
            <Card className="space-y-3 p-5">
              <h2 className="text-lg font-semibold text-foreground">{t('content.meta.title')}</h2>
              {renderContentMeta({ mode, content, access: activeAccess })}
            </Card>

            <Card className="space-y-3 p-5">
              <h2 className="text-lg font-semibold text-foreground">{t('content.history.title')}</h2>
              {renderContentHistory({ mode, history: detailApi.history })}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
};
