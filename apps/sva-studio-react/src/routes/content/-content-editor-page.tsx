import { Link, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { GENERIC_CONTENT_TYPE, withServerDeniedContentAccess, type IamContentAccessSummary, type IamContentStatus } from '@sva/core';
import {
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useContentAccess } from '../../hooks/use-content-access';
import { useContentDetail, useCreateContent } from '../../hooks/use-contents';
import { t } from '../../i18n';
import { formatContentAuthor } from '../../lib/content-author';
import { formatEditorDateTime, parseOptionalEditorDateTime, toDatetimeLocalValue } from '../../lib/editor-date-time';
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
  return toDatetimeLocalValue(value);
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('content.table.notPublished');
  }

  return formatEditorDateTime(value) ?? value;
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

const contentStatusSchema = z.enum(['draft', 'in_review', 'approved', 'published', 'archived']);

const createContentFormSchema = (originalPublishedAt?: string) =>
  z
    .object({
      title: z.string().trim().min(1, t('content.validation.titleRequired')),
      contentType: z.string(),
      status: contentStatusSchema,
      publishedAt: z.string(),
      payloadText: z.string(),
    })
    .superRefine((values, context) => {
      const parsedPayload = parseContentPayload(values.payloadText);
      if (!parsedPayload.ok) {
        context.addIssue({
          code: 'custom',
          path: ['payloadText'],
          message: parsedPayload.message,
        });
      }

      const publishedAt = parseOptionalEditorDateTime(values.publishedAt, originalPublishedAt);
      if (publishedAt.kind === 'invalid') {
        context.addIssue({
          code: 'custom',
          path: ['publishedAt'],
          message: t('content.validation.publishedAtInvalid'),
        });
      }

      if (values.status === 'published' && publishedAt.kind === 'empty') {
        context.addIssue({
          code: 'custom',
          path: ['publishedAt'],
          message: t('content.validation.publishedAtRequired'),
        });
      }
    });

const toDeniedAccess = (errorCode: IamHttpError['code'] | undefined): IamContentAccessSummary | null =>
  errorCode === 'forbidden' ? withServerDeniedContentAccess(undefined) : null;

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
): readonly StudioFormFieldError[] =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

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
        <dd className="text-foreground">{content ? formatContentAuthor(content.author) : '—'}</dd>
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
  const detailApi = useContentDetail(mode === 'edit' ? contentId ?? null : null);
  const contentAccessApi = useContentAccess();
  const formSchema = React.useMemo(
    () => createContentFormSchema(detailApi.content?.publishedAt),
    [detailApi.content?.publishedAt]
  );
  const form = useForm<ContentFormState>({
    defaultValues: emptyFormState(),
    resolver: zodResolver(formSchema as never),
    reValidateMode: 'onChange',
  });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    watch,
  } = form;

  React.useEffect(() => {
    if (mode === 'edit' && detailApi.content) {
      reset(buildFormState(detailApi.content));
    }
  }, [detailApi.content, mode, reset]);

  const activeError = mode === 'create' ? createApi.mutationError : detailApi.mutationError;
  const isLoading = mode === 'create' ? false : detailApi.isLoading;
  const content = detailApi.content;

  const activeAccess = (() => {
    if (mode === 'edit') {
      return content?.access ?? toDeniedAccess(detailApi.error?.code);
    }
    return contentAccessApi.access ?? toDeniedAccess(activeError?.code);
  })();

  const isReadOnly = mode === 'edit' && activeAccess?.canRead === true && activeAccess.canUpdate === false;

  const actionsDisabled = (() => {
    if (mode === 'create') {
      return activeAccess ? !activeAccess.canCreate : activeError?.code === 'forbidden';
    }
    return !activeAccess?.canUpdate;
  })();

  const statusValue = watch('status');
  const titleField = getStudioFormFieldProps({
    id: 'content-title',
    error: errors.title,
  });
  const contentTypeField = getStudioFormFieldProps({
    id: 'content-type',
    error: errors.contentType,
  });
  const statusField = getStudioFormFieldProps({
    id: 'content-status',
    error: errors.status,
  });
  const publishedAtField = getStudioFormFieldProps({
    id: 'content-published-at',
    error: errors.publishedAt,
  });
  const payloadField = getStudioFormFieldProps({
    id: 'content-payload',
    error: errors.payloadText,
  });
  const summaryErrors = collectSummaryErrors([titleField, contentTypeField, statusField, publishedAtField, payloadField]);

  const submitCreate = async (values: ContentFormState): Promise<void> => {
    const parsedPayload = parseContentPayload(values.payloadText);
    if (!parsedPayload.ok) {
      return;
    }
    const publishedAt = parseOptionalEditorDateTime(values.publishedAt, detailApi.content?.publishedAt);
    if (publishedAt.kind === 'invalid') {
      return;
    }
    const payload: CreateContentPayload = {
      title: values.title.trim(),
      contentType: values.contentType,
      status: values.status,
      publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
      payload: parsedPayload.payload as CreateContentPayload['payload'],
    };

    const success = await createApi.createContent(payload);
    if (success) {
      await navigate({ to: '/admin/content' });
    }
  };

  const submitUpdate = async (values: ContentFormState): Promise<void> => {
    if (!contentId) {
      return;
    }
    const parsedPayload = parseContentPayload(values.payloadText);
    if (!parsedPayload.ok) {
      return;
    }
    const publishedAt = parseOptionalEditorDateTime(values.publishedAt, detailApi.content?.publishedAt);
    if (publishedAt.kind === 'invalid') {
      return;
    }

    const payload: UpdateContentPayload = {
      title: values.title.trim(),
      status: values.status,
      publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
      payload: parsedPayload.payload as UpdateContentPayload['payload'],
    };

    await detailApi.updateContent(payload);
  };

  const submitForm = handleSubmit(async (values) => {
    if (actionsDisabled) {
      return;
    }

    if (mode === 'create') {
      await submitCreate(values);
    } else {
      await submitUpdate(values);
    }
  });

  return (
    <section className="space-y-5" aria-busy={isLoading || isSubmitting}>
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
          <Link to="/admin/content">{t('content.actions.back')}</Link>
        </Button>
      </header>

      {detailApi.error && mode === 'edit' ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(detailApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      {activeError ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(activeError)}</AlertDescription>
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
            <form className="space-y-4" onSubmit={submitForm} noValidate>
              <StudioFormSummaryErrors errors={summaryErrors} title={t('account.messages.validationSummary')} />
              <StudioFieldGroup columns={2}>
                <StudioField {...titleField} label={t('content.fields.title')} required className="md:col-span-2">
                  <Input {...register('title')} disabled={actionsDisabled} />
                </StudioField>
                <StudioField {...contentTypeField} label={t('content.fields.contentType')}>
                  <Input {...register('contentType')} readOnly />
                </StudioField>
                <StudioField {...statusField} label={t('content.fields.status')}>
                  <Select {...register('status')} disabled={actionsDisabled}>
                    <option value="draft">{t('content.status.draft')}</option>
                    <option value="in_review">{t('content.status.inReview')}</option>
                    <option value="approved">{t('content.status.approved')}</option>
                    <option value="published">{t('content.status.published')}</option>
                    <option value="archived">{t('content.status.archived')}</option>
                  </Select>
                </StudioField>
                <StudioField {...publishedAtField} label={t('content.fields.publishedAt')} className="md:col-span-2">
                  <Input
                    {...register('publishedAt')}
                    type="datetime-local"
                    disabled={actionsDisabled}
                    required={statusValue === 'published'}
                  />
                </StudioField>
                <StudioField {...payloadField} label={t('content.fields.payload')} className="md:col-span-2">
                  <Textarea
                    {...register('payloadText')}
                    disabled={actionsDisabled}
                    className="min-h-[22rem] font-mono text-xs"
                  />
                </StudioField>
              </StudioFieldGroup>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={actionsDisabled}>
                  {mode === 'create' ? t('content.actions.createNow') : t('content.actions.save')}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin/content">{t('content.actions.cancel')}</Link>
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
