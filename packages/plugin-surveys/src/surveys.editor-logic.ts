import { createSurveyEditorSubmit } from './surveys.editor-save.js';
import React from 'react';
import { type UseFormReturn } from 'react-hook-form';
import {
  useStudioEditorLeaveGuard,
  useStudioSaveFeedback,
  useStudioTableQuery,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';

import { getSurveyDetail } from './surveys.api.js';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from './surveys.detail-form.js';
import {
  getSurveyEditorErrorMessage,
  mapSurveyItemToFormValues,
  type SurveyEditorMode,
} from './surveys.editor.shared.js';
import type { SurveyContentItem } from './surveys.types.js';

export type SurveyEditorStatus =
  { kind: 'success'; text: string } | { kind: 'error'; text: string } | null;

type SurveyEditorTranslation = (key: string) => string;

function useSurveyCreateGuard(
  mode: SurveyEditorMode,
  methods: UseFormReturn<SurveyDetailFormValues>
) {
  const createdContentIdRef = React.useRef<string | null>(null);
  const [createdContentId, setCreatedContentId] = React.useState<string | null>(null);
  const rememberCreated = React.useCallback((id: string) => {
    createdContentIdRef.current = id;
    setCreatedContentId(id);
  }, []);
  const leaveGuard = useStudioEditorLeaveGuard({
    enabled: mode === 'create',
    hasUnsavedChanges: methods.formState.isDirty,
  });
  React.useEffect(() => {
    if (mode !== 'create') return;
    const subscription = methods.watch((_values, { name }) => {
      if (name) leaveGuard.markChanged();
    });
    return () => subscription.unsubscribe();
  }, [methods, mode, leaveGuard]);
  return { createdContentIdRef, createdContentId, rememberCreated, leaveGuard };
}

export const useSurveyEditorController = ({
  mode,
  contentId,
  methods,
  pt,
  navigateToCreatedDetail,
  initiallySaved = false,
  onInitialSavedConsumed,
  actingPrincipalType,
}: Readonly<{
  mode: SurveyEditorMode;
  contentId?: string;
  methods: UseFormReturn<SurveyDetailFormValues>;
  pt: SurveyEditorTranslation;
  navigateToCreatedDetail: (contentId: string) => Promise<void>;
  initiallySaved?: boolean;
  onInitialSavedConsumed?: () => Promise<void>;
  actingPrincipalType: MainserverPrincipalType;
}>) => {
  const [status, setStatus] = React.useState<SurveyEditorStatus>(null);
  const [formBaseline, setFormBaseline] = React.useState<SurveyContentItem | null>(null);
  const editing = mode === 'edit';
  const detail = useStudioTableQuery(
    ['surveys', 'detail', contentId, actingPrincipalType],
    () => {
      if (!contentId) throw new Error('missing_content_id');
      return getSurveyDetail(contentId, actingPrincipalType);
    },
    editing && Boolean(contentId)
  );
  const lastDetail = React.useRef<typeof detail.data>(undefined);
  const isDirty = methods.formState.isDirty;
  const shouldClearForm =
    !editing || !contentId || !detail.isAvailable || (!detail.data && Boolean(detail.error));
  React.useLayoutEffect(() => {
    if (!shouldClearForm) return;
    lastDetail.current = undefined;
    setFormBaseline(null);
    methods.reset(createDefaultSurveyDetailFormValues());
  }, [contentId, shouldClearForm, methods]);
  React.useLayoutEffect(() => {
    if (shouldClearForm || !detail.data || lastDetail.current === detail.data) return;
    lastDetail.current = detail.data;
    const item = detail.data.data;
    if (formBaseline?.id === contentId && isDirty) return;
    setFormBaseline(item);
    methods.reset(mapSurveyItemToFormValues(item));
  }, [contentId, detail.data, formBaseline?.id, isDirty, methods, shouldClearForm]);
  const isLoading = editing && Boolean(contentId) && detail.state === 'loading';
  const loadStatus: SurveyEditorStatus =
    editing && !contentId
      ? { kind: 'error', text: pt('messages.missingContentId') }
      : detail.error
        ? {
            kind: 'error',
            text: getSurveyEditorErrorMessage(detail.error, pt('messages.loadError')),
          }
        : null;
  const saveFeedback = useStudioSaveFeedback();
  const { createdContentIdRef, createdContentId, rememberCreated, leaveGuard } =
    useSurveyCreateGuard(mode, methods);
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (methods.formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [methods.formState.isDirty, saveFeedback.markDirty]);
  React.useEffect(() => {
    if (isLoading || !initiallySaved || initialSaveFeedbackShownRef.current) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void onInitialSavedConsumed?.();
  }, [initiallySaved, isLoading, onInitialSavedConsumed, saveFeedback]);
  const submit = createSurveyEditorSubmit({
    methods,
    leaveGuard,
    createdContentIdRef,
    rememberCreated,
    mode,
    contentId,
    loadedItem: detail.data && formBaseline?.id === contentId ? formBaseline : null,
    readCurrentItem: async () => (await detail.refresh(true))?.data,
    actingPrincipalType,
    pt,
    navigateToCreatedDetail,
    setLoadedItem: async (item) => {
      setFormBaseline(item);
      if (detail.data) await detail.replaceData({ ...detail.data, data: item });
    },
    setStatus,
    saveFeedback,
  });

  return {
    createdContentId,
    isLoading,
    loadedItem: detail.data?.data ?? (editing ? null : formBaseline),
    resourceAccess: detail.error ? {} : (detail.data?.access ?? {}),
    saveStatus: saveFeedback.status,
    status: status ?? loadStatus,
    submit,
  };
};
