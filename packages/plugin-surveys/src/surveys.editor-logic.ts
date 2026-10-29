import { createSurveyEditorSubmit } from './surveys.editor-save.js';
import React from 'react';
import { type UseFormReturn } from 'react-hook-form';
import {
  useStudioEditorLeaveGuard,
  useStudioSaveFeedback,
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

type SurveyEditorLoaderInput = Readonly<{
  mode: SurveyEditorMode;
  contentId?: string;
  methods: UseFormReturn<SurveyDetailFormValues>;
  pt: SurveyEditorTranslation;
  setStatus: React.Dispatch<React.SetStateAction<SurveyEditorStatus>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadedItem: React.Dispatch<React.SetStateAction<SurveyContentItem | null>>;
  setResourceAccess: React.Dispatch<React.SetStateAction<Readonly<Record<string, boolean>>>>;
  actingPrincipalType: MainserverPrincipalType;
}>;

const useSurveyEditorLoader = ({
  mode,
  contentId,
  methods,
  pt,
  setStatus,
  setIsLoading,
  setLoadedItem,
  setResourceAccess,
  actingPrincipalType,
}: SurveyEditorLoaderInput) => {
  const loadedContentIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (mode !== 'edit') {
      loadedContentIdRef.current = undefined;
      setStatus(null);
      setIsLoading(false);
      setLoadedItem(null);
      methods.reset(createDefaultSurveyDetailFormValues());
      return;
    }

    if (!contentId) {
      setStatus({ kind: 'error', text: pt('messages.missingContentId') });
      setLoadedItem(null);
      methods.reset(createDefaultSurveyDetailFormValues());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const refreshesAccessOnly = loadedContentIdRef.current === contentId;
    if (!refreshesAccessOnly) {
      setIsLoading(true);
      setStatus(null);
    }

    void getSurveyDetail(contentId, actingPrincipalType)
      .then((detail) => {
        if (cancelled) return;
        setResourceAccess(detail.access);
        if (refreshesAccessOnly) return;
        const item = detail.data;
        setLoadedItem(item);
        methods.reset(mapSurveyItemToFormValues(item));
        loadedContentIdRef.current = contentId;
      })
      .catch((error) => {
        if (!cancelled) {
          if (refreshesAccessOnly) setResourceAccess({});
          else {
            setLoadedItem(null);
            methods.reset(createDefaultSurveyDetailFormValues());
            setStatus({
              kind: 'error',
              text: getSurveyEditorErrorMessage(error, pt('messages.loadError')),
            });
          }
        }
      })
      .finally(() => {
        if (!cancelled && !refreshesAccessOnly) {
          setIsLoading(false);
        }
      });

    return () => void (cancelled = true);
  }, [
    actingPrincipalType,
    contentId,
    methods,
    mode,
    pt,
    setIsLoading,
    setLoadedItem,
    setResourceAccess,
    setStatus,
  ]);
};

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
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [loadedItem, setLoadedItem] = React.useState<SurveyContentItem | null>(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const saveFeedback = useStudioSaveFeedback();
  const { createdContentIdRef, createdContentId, rememberCreated, leaveGuard } =
    useSurveyCreateGuard(mode, methods);
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (methods.formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [methods.formState.isDirty, saveFeedback.markDirty]);
  useSurveyEditorLoader({
    mode,
    contentId,
    methods,
    pt,
    setStatus,
    setIsLoading,
    setLoadedItem,
    setResourceAccess,
    actingPrincipalType,
  });
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
    loadedItem,
    actingPrincipalType,
    pt,
    navigateToCreatedDetail,
    setLoadedItem,
    setStatus,
    saveFeedback,
  });

  return {
    createdContentId,
    isLoading,
    loadedItem,
    resourceAccess,
    saveStatus: saveFeedback.status,
    status,
    submit,
  };
};
