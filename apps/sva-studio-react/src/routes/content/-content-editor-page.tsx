import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GENERIC_CONTENT_TYPE,
  withServerDeniedContentAccess,
  type IamContentAccessSummary,
  type IamContentOwnerPrincipal,
  type IamContentOwnershipTarget,
  type IamContentStatus,
} from '@sva/core';
import { FilePenLine, History } from 'lucide-react';
import {
  addStudioCreatedSaveFeedback,
  Button,
  ContentOwnershipPanel,
  getStudioFormFieldProps,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  Select as StudioSelect,
  StudioDetailPageTemplate,
  StudioField,
  StudioFieldGroup,
  type StudioFormFieldError,
  StudioFormSummaryErrors,
  StudioPersistentFormError,
  StudioResourceHeader,
  StudioSaveButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select as FieldSelect } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useContentAccess } from '../../hooks/use-content-access';
import { useContentDetail, useCreateContent } from '../../hooks/use-contents';
import { t } from '../../i18n';
import { formatContentAuthor } from '../../lib/content-author';
import {
  formatEditorDateTime,
  parseOptionalEditorDateTime,
  toDatetimeLocalValue,
} from '../../lib/editor-date-time';
import {
  listContentOwnershipTargets,
  transferContentOwnership,
  type CreateContentPayload,
  type IamHttpError,
  type UpdateContentPayload,
} from '../../lib/iam-api';
import { getStudioPermissionDenialMessage } from '../../lib/studio-permission-denial-message';

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
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
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

const parseContentPayload = (
  payloadText: string
): { ok: true; payload: unknown } | { ok: false; message: string } => {
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

const toDeniedAccess = (
  errorCode: IamHttpError['code'] | undefined
): IamContentAccessSummary | null =>
  errorCode === 'forbidden' ? withServerDeniedContentAccess(undefined) : null;

const resolveActiveAccess = ({
  mode,
  content,
  detailErrorCode,
  createAccess,
  activeErrorCode,
}: {
  mode: ContentEditorPageProps['mode'];
  content: ReturnType<typeof useContentDetail>['content'];
  detailErrorCode: IamHttpError['code'] | undefined;
  createAccess: IamContentAccessSummary | null | undefined;
  activeErrorCode: IamHttpError['code'] | undefined;
}): IamContentAccessSummary | null => {
  if (mode === 'edit') {
    return content?.access ?? toDeniedAccess(detailErrorCode);
  }

  return createAccess ?? toDeniedAccess(activeErrorCode);
};

const resolveLocalContentOwner = (content: {
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
}): IamContentOwnerPrincipal | undefined => {
  if (content.ownerUserId && !content.ownerOrganizationId) {
    return { type: 'account', id: content.ownerUserId };
  }
  if (content.ownerOrganizationId && !content.ownerUserId) {
    return { type: 'organization', id: content.ownerOrganizationId };
  }
  return undefined;
};

const isEditorActionDisabled = ({
  mode,
  activeAccess,
  activeErrorCode,
}: {
  mode: ContentEditorPageProps['mode'];
  activeAccess: IamContentAccessSummary | null;
  activeErrorCode: IamHttpError['code'] | undefined;
}): boolean => {
  if (mode === 'create') {
    return activeAccess ? !activeAccess.canCreate : activeErrorCode === 'forbidden';
  }

  return !activeAccess?.canUpdate;
};

const resolveTabPanelBody = (
  tabId: ContentEditorTabId,
  mode: ContentEditorPageProps['mode'],
  history: ReturnType<typeof useContentDetail>['history'],
  renderGeneralTabPanel: () => React.JSX.Element
): React.JSX.Element => {
  if (tabId === 'general') {
    return renderGeneralTabPanel();
  }

  return renderContentHistory({ mode, history });
};

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
            <span className="text-sm font-medium text-foreground">
              {t(historyActionLabelKey[entry.action])}
            </span>
            <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('content.history.byline', { actor: entry.actor })}
          </p>
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

export const ContentEditorPage = ({
  mode,
  contentId,
  activeTab,
  onTabChange,
}: ContentEditorPageProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalActiveTab, setInternalActiveTab] = React.useState<ContentEditorTabId>(
    activeTab ?? 'general'
  );
  const createApi = useCreateContent();
  const detailApi = useContentDetail(mode === 'edit' ? (contentId ?? null) : null);
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
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    watch,
  } = form;
  const saveFeedback = useStudioSaveFeedback();
  const [ownershipFeedback, setOwnershipFeedback] = React.useState<{
    readonly tone: 'success' | 'error';
    readonly message: string;
  } | null>(null);

  React.useEffect(() => {
    if (isDirty) {
      saveFeedback.markDirty();
    }
  }, [isDirty, saveFeedback.markDirty]);

  React.useEffect(() => {
    if (mode === 'edit' && detailApi.content) {
      reset(buildFormState(detailApi.content));
    }
  }, [detailApi.content, mode, reset]);

  const activeError = mode === 'create' ? createApi.mutationError : detailApi.mutationError;
  const isLoading = mode === 'create' ? false : detailApi.isLoading;
  const content = detailApi.content;
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      isLoading ||
      !content ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'content', contentId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/content/$contentId',
      params: { contentId: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [content, contentId, isLoading, location.state, navigate, saveFeedback]);

  const activeAccess = resolveActiveAccess({
    mode,
    content,
    detailErrorCode: detailApi.error?.code,
    createAccess: contentAccessApi.access,
    activeErrorCode: activeError?.code,
  });

  const isReadOnly =
    mode === 'edit' && activeAccess?.canRead === true && activeAccess.canUpdate === false;

  const actionsDisabled = isEditorActionDisabled({
    mode,
    activeAccess,
    activeErrorCode: activeError?.code,
  });

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
  const summaryErrors = collectSummaryErrors([
    titleField,
    contentTypeField,
    statusField,
    publishedAtField,
    payloadField,
  ]);
  const formId = React.useId();
  const primaryActionLabel =
    mode === 'create' ? t('content.actions.createNow') : t('content.actions.save');
  const submitDisabled =
    actionsDisabled ||
    saveFeedback.status === 'saving' ||
    isLoading ||
    (mode === 'edit' && !content);
  const showEditorTabs = mode === 'create' || Boolean(content);
  const resolvedActiveTab = activeTab ?? internalActiveTab;
  const visibleTabs = React.useMemo<readonly ContentEditorTabId[]>(
    () => (mode === 'edit' ? ['general', 'history'] : ['general']),
    [mode]
  );
  const [visitedTabs, setVisitedTabs] = React.useState<readonly ContentEditorTabId[]>([
    resolvedActiveTab,
  ]);

  const submitCreate = async (values: ContentFormState): Promise<boolean> => {
    const parsedPayload = parseContentPayload(values.payloadText);
    if (!parsedPayload.ok) {
      return false;
    }
    const publishedAt = parseOptionalEditorDateTime(
      values.publishedAt,
      detailApi.content?.publishedAt
    );
    if (publishedAt.kind === 'invalid') {
      return false;
    }
    const payload: CreateContentPayload = {
      title: values.title.trim(),
      contentType: values.contentType,
      status: values.status,
      publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
      payload: parsedPayload.payload as CreateContentPayload['payload'],
    };

    const created = await createApi.createContent(payload);
    if (created) {
      await navigate({
        to: '/admin/content/$contentId',
        params: { contentId: created.id },
        state: (previous) => addStudioCreatedSaveFeedback(previous, 'content', created.id),
      });
    }
    return Boolean(created);
  };

  const submitUpdate = async (values: ContentFormState): Promise<boolean> => {
    if (!contentId) {
      return false;
    }
    const parsedPayload = parseContentPayload(values.payloadText);
    if (!parsedPayload.ok) {
      return false;
    }
    const publishedAt = parseOptionalEditorDateTime(
      values.publishedAt,
      detailApi.content?.publishedAt
    );
    if (publishedAt.kind === 'invalid') {
      return false;
    }

    const payload: UpdateContentPayload = {
      title: values.title.trim(),
      status: values.status,
      publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
      payload: parsedPayload.payload as UpdateContentPayload['payload'],
    };

    return detailApi.updateContent(payload);
  };

  const saveValues = async (values: ContentFormState) => {
    if (actionsDisabled) {
      return;
    }

    const operationId = saveFeedback.beginSaving();
    let success: boolean;
    if (mode === 'create') {
      success = await submitCreate(values);
    } else {
      success = await submitUpdate(values);
    }
    (success ? saveFeedback.markSaved : saveFeedback.markFailed)(operationId);
  };
  const submitForm = handleSubmit(saveValues, () => saveFeedback.reset());

  React.useEffect(() => {
    if (activeTab === undefined) {
      return;
    }

    setInternalActiveTab(activeTab);
  }, [activeTab]);

  React.useEffect(() => {
    setVisitedTabs((current) =>
      current.includes(resolvedActiveTab) ? current : [...current, resolvedActiveTab]
    );
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

  const currentOwner = content ? resolveLocalContentOwner(content) : undefined;
  const ownershipTransferSupported =
    mode === 'edit' &&
    content?.contentType === GENERIC_CONTENT_TYPE &&
    !content.sourceDataProviderId;
  const canTransferOwnership =
    ownershipTransferSupported &&
    contentAccessApi.permissionActions.includes('content.transferOwnership');
  const loadOwnershipTargets = React.useCallback(
    async (input: {
      readonly type: 'account' | 'organization';
      readonly page: number;
      readonly pageSize: number;
      readonly search?: string;
    }) => {
      if (!contentId) return { items: [], total: 0 };
      const response = await listContentOwnershipTargets(contentId, {
        type: input.type,
        page: input.page,
        pageSize: input.pageSize,
        ...(input.search ? { q: input.search } : {}),
      });
      return { items: response.data, total: response.pagination?.total ?? response.data.length };
    },
    [contentId]
  );
  const submitOwnershipTransfer = React.useCallback(
    async (target: IamContentOwnershipTarget) => {
      if (!contentId) return;
      setOwnershipFeedback(null);
      try {
        await transferContentOwnership(contentId, { targetPrincipal: target.principal });
        setOwnershipFeedback({ tone: 'success', message: t('content.ownership.success') });
        await detailApi.refetch();
      } catch {
        setOwnershipFeedback({ tone: 'error', message: t('content.ownership.error') });
        throw new Error('content_transfer_ownership_failed');
      }
    },
    [contentId, detailApi.refetch]
  );

  const renderGeneralTabPanel = () => (
    <div className="space-y-5">
      {mode === 'edit' && content ? (
        <ContentOwnershipPanel
          currentOwner={{
            ...(currentOwner ? { principal: currentOwner } : {}),
            displayName: currentOwner?.id ?? t('content.ownership.noOwner'),
          }}
          supported={ownershipTransferSupported}
          canTransfer={canTransferOwnership}
          labels={{
            title: t('content.ownership.title'),
            currentOwner: t('content.ownership.currentOwner'),
            account: t('content.ownership.account'),
            organization: t('content.ownership.organization'),
            saveKeepsOwner: t('content.ownership.saveKeepsOwner'),
            transferUnavailable: t('content.ownership.transferUnavailable'),
            transferForbidden: t('content.ownership.transferForbidden'),
            transferAction: t('content.ownership.transferAction'),
            dialogTitle: t('content.ownership.dialogTitle'),
            dialogDescription: t('content.ownership.dialogDescription'),
            targetType: t('content.ownership.targetType'),
            search: t('content.ownership.search'),
            searchAction: t('content.ownership.searchAction'),
            loading: t('content.ownership.loading'),
            loadError: t('content.ownership.loadError'),
            noTargets: t('content.ownership.noTargets'),
            previousPage: t('content.ownership.previousPage'),
            nextPage: t('content.ownership.nextPage'),
            confirmation: t('content.ownership.confirmation'),
            accessWarning: t('content.ownership.accessWarning'),
            authorEffect: t('content.ownership.localAuthorEffect'),
            cancel: t('content.ownership.cancel'),
            confirm: t('content.ownership.confirm'),
            transferring: t('content.ownership.transferring'),
            transferError: t('content.ownership.error'),
          }}
          loadTargets={loadOwnershipTargets}
          onTransfer={submitOwnershipTransfer}
        />
      ) : null}
      <form id={formId} className="space-y-4" onSubmit={submitForm} noValidate>
        <StudioFormSummaryErrors
          errors={summaryErrors}
          title={t('account.messages.validationSummary')}
        />
        <StudioFieldGroup columns={2}>
          <StudioField
            {...titleField}
            label={t('content.fields.title')}
            required
            className="md:col-span-2"
          >
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
          <StudioField
            {...publishedAtField}
            label={t('content.fields.publishedAt')}
            className="md:col-span-2"
          >
            <Input
              {...register('publishedAt')}
              type="datetime-local"
              disabled={actionsDisabled}
              required={statusValue === 'published'}
            />
          </StudioField>
          <StudioField
            {...payloadField}
            label={t('content.fields.payload')}
            className="md:col-span-2"
          >
            <Textarea
              {...register('payloadText')}
              disabled={actionsDisabled}
              className="min-h-[22rem] font-mono text-xs"
            />
          </StudioField>
        </StudioFieldGroup>
      </form>
    </div>
  );

  return (
    <section className="space-y-5" aria-busy={isLoading || saveFeedback.status === 'saving'}>
      <div>
        <Button asChild variant="secondary">
          <Link to="/admin/content">{t('content.actions.back')}</Link>
        </Button>
      </div>

      <StudioDetailPageTemplate
        title={mode === 'create' ? t('content.editor.createTitle') : t('content.editor.editTitle')}
        description={
          mode === 'create' ? t('content.editor.createSubtitle') : t('content.editor.editSubtitle')
        }
        primaryAction={
          <div className="space-y-1 text-right">
            <StudioSaveButton
              type="submit"
              form={formId}
              status={saveFeedback.status}
              disabled={submitDisabled}
              labels={{
                idle: primaryActionLabel,
                saving: t('account.actions.saving'),
                saved: t('account.actions.saved'),
              }}
            />
            {mode === 'edit' ? (
              <p className="max-w-xs text-xs text-muted-foreground">
                {t('content.ownership.saveKeepsOwner')}
              </p>
            ) : null}
          </div>
        }
      >
        {detailApi.error && mode === 'edit' ? (
          <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
            <AlertDescription>{contentErrorMessage(detailApi.error)}</AlertDescription>
          </Alert>
        ) : null}

        {activeError ? (
          <StudioPersistentFormError
            message={contentErrorMessage(activeError)}
            retryLabel={t('account.actions.retry')}
            retryDisabled={saveFeedback.status === 'saving'}
            onRetry={() => void submitForm()}
          />
        ) : null}

        {ownershipFeedback ? (
          <Alert
            className={
              ownershipFeedback.tone === 'error'
                ? 'border-destructive/40 bg-destructive/5 text-destructive'
                : 'border-primary/40 bg-primary/5 text-primary'
            }
          >
            <AlertDescription>{ownershipFeedback.message}</AlertDescription>
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
            status={
              <Badge variant={statusVariantByValue[content.status]}>
                {t(statusLabelKeyByValue[content.status])}
              </Badge>
            }
            description={content.contentType}
            metadata={[
              {
                id: 'author',
                label: t('content.meta.author'),
                value: formatContentAuthor(content.author),
              },
              {
                id: 'createdAt',
                label: t('content.meta.createdAt'),
                value: formatDateTime(content.createdAt),
              },
              {
                id: 'updatedAt',
                label: t('content.meta.updatedAt'),
                value: formatDateTime(content.updatedAt),
              },
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
                  onChange={(event) =>
                    handleTabChange(normalizeContentEditorTab(event.target.value))
                  }
                >
                  {visibleTabs.map((tabId) => (
                    <option key={tabId} value={tabId}>
                      {t(contentEditorTabLabelKeyMap[tabId])}
                    </option>
                  ))}
                </StudioSelect>
              </label>

              <TabsList
                aria-label={t('content.tabs.ariaLabel')}
                className="ml-[10px] hidden gap-10 md:flex"
              >
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
                        isActive
                          ? 'mb-[-1px] border-primary text-primary'
                          : 'border-transparent text-muted-foreground'
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
                const shouldKeepMounted =
                  visitedTabs.includes(tabId) && tabId !== resolvedActiveTab;

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
                          <h2 className="text-base font-semibold text-foreground">
                            {t(contentEditorTabLabelKeyMap[tabId])}
                          </h2>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {t(contentEditorTabBodyKeyMap[tabId])}
                          </p>
                        </div>
                      </section>

                      {resolveTabPanelBody(tabId, mode, detailApi.history, renderGeneralTabPanel)}
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
