import { Link, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { GENERIC_CONTENT_TYPE, withServerDeniedContentAccess, type IamContentAccessSummary, type IamContentStatus } from '@sva/core';
import { FilePenLine, History } from 'lucide-react';
import {
  StudioDetailPageTemplate,
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  StudioResourceHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select as StudioSelect,
  getStudioFormFieldProps,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select as FieldSelect } from '../../components/ui/select';
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
  readonly activeTab?: ContentEditorTabId;
  readonly onTabChange?: (tab: ContentEditorTabId) => void;
};

type ContentFormState = {
  title: string;
  contentType: string;
  status: IamContentStatus;
  publishedAt: string;
  payloadText: string;
};

type ContentEditorTabId = 'general' | 'history';

const contentEditorTabIds = ['general', 'history'] as const satisfies readonly ContentEditorTabId[];

const emptyFormState = (): ContentFormState => ({
  title: '',
  contentType: GENERIC_CONTENT_TYPE,
  status: 'draft',
  publishedAt: '',
  payloadText: '{}',
});

export const normalizeContentEditorTab = (value: unknown): ContentEditorTabId =>
  typeof value === 'string' && contentEditorTabIds.includes(value as ContentEditorTabId)
    ? (value as ContentEditorTabId)
    : 'general';

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

const resolveResourceTitle = (content: ReturnType<typeof useContentDetail>['content']): string =>
  content?.title.trim() || content?.id || '—';

const contentEditorTabIconMap = {
  general: FilePenLine,
  history: History,
} as const satisfies Record<ContentEditorTabId, typeof FilePenLine>;

const contentEditorTabLabelKeyMap = {
  general: 'content.tabs.generalTitle',
  history: 'content.history.title',
} as const satisfies Record<ContentEditorTabId, string>;

const contentEditorTabBodyKeyMap = {
  general: 'content.tabs.generalDescription',
  history: 'content.tabs.historyDescription',
} as const satisfies Record<ContentEditorTabId, string>;

export const ContentEditorPage = ({ mode, contentId, activeTab, onTabChange }: ContentEditorPageProps) => {
  const navigate = useNavigate();
  const [internalActiveTab, setInternalActiveTab] = React.useState<ContentEditorTabId>(activeTab ?? 'general');
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
  const formId = React.useId();
  const primaryActionLabel = mode === 'create' ? t('content.actions.createNow') : t('content.actions.save');
  const submitDisabled = actionsDisabled || isSubmitting || isLoading || (mode === 'edit' && !content);
  const showEditorTabs = mode === 'create' || Boolean(content);
  const resolvedActiveTab = activeTab ?? internalActiveTab;
  const visibleTabs = React.useMemo<readonly ContentEditorTabId[]>(
    () => (mode === 'edit' ? ['general', 'history'] : ['general']),
    [mode]
  );
  const [visitedTabs, setVisitedTabs] = React.useState<readonly ContentEditorTabId[]>([resolvedActiveTab]);

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

  React.useEffect(() => {
    if (activeTab === undefined) {
      return;
    }

    setInternalActiveTab(activeTab);
  }, [activeTab]);

  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(resolvedActiveTab) ? current : [...current, resolvedActiveTab]));
  }, [resolvedActiveTab]);

  const warmTab = React.useCallback((tabId: ContentEditorTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  const handleTabChange = React.useCallback(
    (nextTab: ContentEditorTabId) => {
      if (activeTab === undefined) {
        setInternalActiveTab(nextTab);
      }

      onTabChange?.(nextTab);
    },
    [activeTab, onTabChange]
  );

  const renderGeneralTabPanel = () => (
    <div className="space-y-5">
      <form id={formId} className="space-y-4" onSubmit={submitForm} noValidate>
        <StudioFormSummaryErrors errors={summaryErrors} title={t('account.messages.validationSummary')} />
        <StudioFieldGroup columns={2}>
          <StudioField {...titleField} label={t('content.fields.title')} required className="md:col-span-2">
            <Input {...register('title')} disabled={actionsDisabled} />
          </StudioField>
          <StudioField {...contentTypeField} label={t('content.fields.contentType')}>
            <Input {...register('contentType')} readOnly />
          </StudioField>
          <StudioField {...statusField} label={t('content.fields.status')}>
            <FieldSelect {...register('status')} disabled={actionsDisabled}>
              <option value="draft">{t('content.status.draft')}</option>
              <option value="in_review">{t('content.status.inReview')}</option>
              <option value="approved">{t('content.status.approved')}</option>
              <option value="published">{t('content.status.published')}</option>
              <option value="archived">{t('content.status.archived')}</option>
            </FieldSelect>
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
      </form>
      <div className="flex flex-wrap gap-3 border-t border-border/60 pt-4">
        <Button asChild variant="outline">
          <Link to="/admin/content">{t('content.actions.cancel')}</Link>
        </Button>
        <Button type="submit" form={formId} disabled={submitDisabled}>
          {primaryActionLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <section className="space-y-5" aria-busy={isLoading || isSubmitting}>
      <div>
        <Button asChild variant="outline">
          <Link to="/admin/content">{t('content.actions.back')}</Link>
        </Button>
      </div>

      <StudioDetailPageTemplate
        title={mode === 'create' ? t('content.editor.createTitle') : t('content.editor.editTitle')}
        description={mode === 'create' ? t('content.editor.createSubtitle') : t('content.editor.editSubtitle')}
        actions={
          mode === 'edit' ? (
            <Button type="submit" form={formId} disabled={submitDisabled}>
              {primaryActionLabel}
            </Button>
          ) : undefined
        }
      >

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
        ) : actionsDisabled ? (
          <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
            <AlertDescription>{t('content.messages.actionsDisabled')}</AlertDescription>
          </Alert>
        ) : null}

        {mode === 'edit' && content ? (
          <StudioResourceHeader
            title={resolveResourceTitle(content)}
            status={<Badge variant={statusVariantByValue[content.status]}>{t(statusLabelKeyByValue[content.status])}</Badge>}
            description={content.contentType}
            metadata={[
              { id: 'author', label: t('content.meta.author'), value: formatContentAuthor(content.author) },
              { id: 'createdAt', label: t('content.meta.createdAt'), value: formatDateTime(content.createdAt) },
              { id: 'updatedAt', label: t('content.meta.updatedAt'), value: formatDateTime(content.updatedAt) },
              { id: 'contentId', label: t('content.meta.id'), value: content.id },
              {
                id: 'access',
                label: t('content.meta.access'),
                value: activeAccess ? t(contentAccessLabelKeyByState[activeAccess.state]) : '—',
              },
            ]}
          />
        ) : null}

        {mode === 'edit' && !content && !detailApi.isLoading ? null : showEditorTabs ? (
          <div className="space-y-4">
            <Tabs
              value={resolvedActiveTab}
              onValueChange={(value) => handleTabChange(normalizeContentEditorTab(value))}
              className="space-y-0"
            >
              <label className="block md:hidden">
                <span className="sr-only">{t('content.tabs.ariaLabel')}</span>
                <StudioSelect
                  aria-label={t('content.tabs.ariaLabel')}
                  className="h-11 rounded-xl border-border/70 bg-card"
                  value={resolvedActiveTab}
                  onChange={(event) => handleTabChange(normalizeContentEditorTab(event.target.value))}
                >
                  {visibleTabs.map((tabId) => (
                    <option key={tabId} value={tabId}>
                      {t(contentEditorTabLabelKeyMap[tabId])}
                    </option>
                  ))}
                </StudioSelect>
              </label>

              <TabsList aria-label={t('content.tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
                {visibleTabs.map((tabId) => {
                  const TabIcon = contentEditorTabIconMap[tabId];
                  const isActive = tabId === resolvedActiveTab;

                  return (
                    <TabsTrigger
                      key={tabId}
                      value={tabId}
                      onMouseEnter={() => warmTab(tabId)}
                      onFocus={() => warmTab(tabId)}
                      className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                        isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span>{t(contentEditorTabLabelKeyMap[tabId])}</span>
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {visibleTabs.map((tabId) => {
                const shouldKeepMounted = visitedTabs.includes(tabId) && tabId !== resolvedActiveTab;

                return (
                  <TabsContent
                    key={tabId}
                    value={tabId}
                    forceMount={shouldKeepMounted || undefined}
                    className="mt-0 data-[state=inactive]:hidden"
                  >
                    <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
                      <section
                        aria-label={t(contentEditorTabLabelKeyMap[tabId])}
                        className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
                      >
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-foreground">{t(contentEditorTabLabelKeyMap[tabId])}</h2>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {t(contentEditorTabBodyKeyMap[tabId])}
                          </p>
                        </div>
                      </section>

                      {tabId === 'general'
                        ? renderGeneralTabPanel()
                        : renderContentHistory({
                            mode,
                            history: detailApi.history,
                          })}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        ) : null}
      </StudioDetailPageTemplate>
    </section>
  );
};
