import { Link } from '@tanstack/react-router';
import type { IamContentAccessSummary } from '@sva/core';
import {
  Button,
  StudioDetailPageTemplate,
  StudioPersistentFormError,
  StudioResourceHeader,
  StudioSaveButton,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import type { useContentDetail } from '../../hooks/use-contents';
import { t } from '../../i18n';
import { formatContentAuthor } from '../../lib/content-author';
import type { IamHttpError } from '../../lib/iam-api';
import { getStudioPermissionDenialMessage } from '../../lib/studio-permission-denial-message';
import {
  ContentEditorTabs,
  formatDateTime,
  type ContentEditorMode,
  type ContentEditorTabId,
} from './-content-editor-tabs';

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

const resolveResourceTitle = (content: ReturnType<typeof useContentDetail>['content']): string =>
  content?.title.trim() || content?.id || '—';

type ContentEditorViewProps = {
  readonly mode: ContentEditorMode;
  readonly detailApi: ReturnType<typeof useContentDetail>;
  readonly activeError: IamHttpError | null;
  readonly ownershipFeedback: {
    readonly tone: 'success' | 'error';
    readonly message: string;
  } | null;
  readonly activeAccess: IamContentAccessSummary | null;
  readonly isReadOnly: boolean;
  readonly actionsDisabled: boolean;
  readonly saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  readonly formId: string;
  readonly submitForm: () => Promise<void>;
  readonly resolvedActiveTab: ContentEditorTabId;
  readonly visibleTabs: readonly ContentEditorTabId[];
  readonly visitedTabs: readonly ContentEditorTabId[];
  readonly handleTabChange: (tab: ContentEditorTabId) => void;
  readonly warmTab: (tab: ContentEditorTabId) => void;
  readonly renderGeneralTabPanel: () => React.JSX.Element;
};

const ContentEditorFeedback = ({
  mode,
  detailApi,
  activeError,
  ownershipFeedback,
  isReadOnly,
  actionsDisabled,
  saveFeedback,
  submitForm,
}: Pick<
  ContentEditorViewProps,
  | 'mode'
  | 'detailApi'
  | 'activeError'
  | 'ownershipFeedback'
  | 'isReadOnly'
  | 'actionsDisabled'
  | 'saveFeedback'
  | 'submitForm'
>) => (
  <>
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
  </>
);

export const ContentEditorView = ({
  mode,
  detailApi,
  activeError,
  ownershipFeedback,
  activeAccess,
  isReadOnly,
  actionsDisabled,
  saveFeedback,
  formId,
  submitForm,
  resolvedActiveTab,
  visibleTabs,
  visitedTabs,
  handleTabChange,
  warmTab,
  renderGeneralTabPanel,
}: ContentEditorViewProps) => {
  const content = detailApi.content;
  const isLoading = mode === 'create' ? false : detailApi.isLoading;
  const primaryActionLabel =
    mode === 'create' ? t('content.actions.createNow') : t('content.actions.save');
  const submitDisabled =
    actionsDisabled ||
    saveFeedback.status === 'saving' ||
    isLoading ||
    (mode === 'edit' && !content);
  const showEditorTabs = mode === 'create' || Boolean(content);
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
        }
      >
        <ContentEditorFeedback
          mode={mode}
          detailApi={detailApi}
          activeError={activeError}
          ownershipFeedback={ownershipFeedback}
          isReadOnly={isReadOnly}
          actionsDisabled={actionsDisabled}
          saveFeedback={saveFeedback}
          submitForm={submitForm}
        />

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
          <ContentEditorTabs
            mode={mode}
            history={detailApi.history}
            resolvedActiveTab={resolvedActiveTab}
            visibleTabs={visibleTabs}
            visitedTabs={visitedTabs}
            handleTabChange={handleTabChange}
            warmTab={warmTab}
            renderGeneralTabPanel={renderGeneralTabPanel}
          />
        ) : null}
      </StudioDetailPageTemplate>
    </section>
  );
};
