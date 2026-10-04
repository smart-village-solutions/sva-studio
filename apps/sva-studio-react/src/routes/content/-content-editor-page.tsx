import { useLocation, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GENERIC_CONTENT_TYPE,
  withServerDeniedContentAccess,
  type IamContentAccessSummary,
  type IamContentOwnerPrincipal,
  type IamContentOwnershipTarget,
} from '@sva/core';
import {
  addStudioCreatedSaveFeedback,
  ContentOwnershipPanel,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { useContentAccess } from '../../hooks/use-content-access';
import { useContentDetail, useCreateContent } from '../../hooks/use-contents';
import { t } from '../../i18n';
import {
  listContentOwnershipTargets,
  transferContentOwnership,
  type IamHttpError,
} from '../../lib/iam-api';
import {
  buildFormState,
  createContentFormSchema,
  emptyFormState,
  type ContentFormState,
} from './-content-editor-form';
import { ContentEditorFormPanel } from './-content-editor-form-panel';
import { saveContentValues } from './-content-editor-save';
import type { ContentEditorTabId } from './-content-editor-tabs';
import { ContentEditorView } from './-content-editor-view';

export { normalizeContentEditorTab } from './-content-editor-tabs';

type ContentEditorPageProps = {
  readonly mode: 'create' | 'edit';
  readonly contentId?: string;
  readonly activeTab?: ContentEditorTabId;
  readonly onTabChange?: (tab: ContentEditorTabId) => void;
};

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
    formState: { isDirty },
    handleSubmit,
    reset,
  } = form;
  const saveFeedback = useStudioSaveFeedback();
  const [ownershipFeedback, setOwnershipFeedback] = React.useState<{
    readonly tone: 'success' | 'error';
    readonly message: string;
  } | null>(null);
  const [transferAuthorized, setTransferAuthorized] = React.useState(false);

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

  const formId = React.useId();
  const resolvedActiveTab = activeTab ?? internalActiveTab;
  const visibleTabs = React.useMemo<readonly ContentEditorTabId[]>(
    () => (mode === 'edit' ? ['general', 'history'] : ['general']),
    [mode]
  );
  const [visitedTabs, setVisitedTabs] = React.useState<readonly ContentEditorTabId[]>([
    resolvedActiveTab,
  ]);

  const saveValues = async (values: ContentFormState) => {
    if (actionsDisabled) {
      return;
    }

    const operationId = saveFeedback.beginSaving();
    const success = await saveContentValues({
      mode,
      values,
      contentId,
      originalPublishedAt: detailApi.content?.publishedAt,
      createContent: createApi.createContent,
      updateContent: detailApi.updateContent,
      onCreated: async (createdId) => {
        await navigate({
          to: '/admin/content/$contentId',
          params: { contentId: createdId },
          state: (previous) => addStudioCreatedSaveFeedback(previous, 'content', createdId),
        });
      },
    });
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
  const canTransferOwnership = ownershipTransferSupported && transferAuthorized;
  React.useEffect(() => {
    if (
      !contentId ||
      !ownershipTransferSupported ||
      !contentAccessApi.permissionActions.includes('content.transferOwnership')
    ) {
      setTransferAuthorized(false);
      return;
    }
    let active = true;
    void listContentOwnershipTargets(contentId, {
      type: 'account',
      page: 1,
      pageSize: 1,
    }).then(
      () => active && setTransferAuthorized(true),
      () => active && setTransferAuthorized(false)
    );
    return () => {
      active = false;
    };
  }, [contentAccessApi.permissionActions, contentId, ownershipTransferSupported]);
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
        const stillAccessible = await detailApi.refetch();
        if (!stillAccessible) await navigate({ to: '/content' });
      } catch {
        setOwnershipFeedback({ tone: 'error', message: t('content.ownership.error') });
        throw new Error('content_transfer_ownership_failed');
      }
    },
    [contentId, detailApi.refetch, navigate]
  );

  const renderGeneralTabPanel = () => (
    <div className="space-y-5">
      {mode === 'edit' && content ? (
        <ContentOwnershipPanel
          currentOwner={{
            ...(currentOwner ? { principal: currentOwner } : {}),
            displayName:
              content?.ownerDisplayName ?? currentOwner?.id ?? t('content.ownership.noOwner'),
          }}
          supported={ownershipTransferSupported}
          canTransfer={canTransferOwnership}
          labels={{
            title: t('content.ownership.title'),
            currentOwner: t('content.ownership.currentOwner'),
            ownerUnresolved: t('content.ownership.ownerUnresolved'),
            ownerResolutionFailed: t('content.ownership.ownerResolutionFailed'),
            account: t('content.ownership.account'),
            organization: t('content.ownership.organization'),
            verificationRequired: t('content.ownership.verificationRequired'),
            saveKeepsOwner: t('content.ownership.saveKeepsOwner'),
            transferUnavailable: t('content.ownership.transferUnavailable'),
            transferForbidden: t('content.ownership.transferForbidden'),
            transferAction: t('content.ownership.transferAction'),
            dialogTitle: t('content.ownership.dialogTitle'),
            dialogDescription: t('content.ownership.dialogDescription'),
            targetOwner: t('content.ownership.targetOwner'),
            targetPlaceholder: t('content.ownership.targetPlaceholder'),
            search: t('content.ownership.search'),
            loading: t('content.ownership.loading'),
            loadError: t('content.ownership.loadError'),
            noTargets: t('content.ownership.noTargets'),
            refineSearch: t('content.ownership.refineSearch'),
            confirmation: t('content.ownership.confirmation'),
            accessWarning: t('content.ownership.accessWarning'),
            authorEffect: t('content.ownership.localAuthorEffect'),
            cancel: t('content.ownership.cancel'),
            confirm: t('content.ownership.confirm'),
            transferring: t('content.ownership.transferring'),
            success: t('content.ownership.success'),
            transferError: t('content.ownership.error'),
          }}
          loadTargets={loadOwnershipTargets}
          onTransfer={submitOwnershipTransfer}
        />
      ) : null}
      <ContentEditorFormPanel
        form={form}
        formId={formId}
        actionsDisabled={actionsDisabled}
        onSubmit={submitForm}
      />
    </div>
  );

  return (
    <ContentEditorView
      mode={mode}
      detailApi={detailApi}
      activeError={activeError}
      ownershipFeedback={ownershipFeedback}
      activeAccess={activeAccess}
      isReadOnly={isReadOnly}
      actionsDisabled={actionsDisabled}
      saveFeedback={saveFeedback}
      formId={formId}
      submitForm={submitForm}
      resolvedActiveTab={resolvedActiveTab}
      visibleTabs={visibleTabs}
      visitedTabs={visitedTabs}
      handleTabChange={handleTabChange}
      warmTab={warmTab}
      renderGeneralTabPanel={renderGeneralTabPanel}
    />
  );
};
