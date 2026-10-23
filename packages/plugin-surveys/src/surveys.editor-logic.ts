import React from 'react';
import { type UseFormReturn } from 'react-hook-form';
import {
  useStudioEditorLeaveGuard,
  useStudioSaveFeedback,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';

import { createSurvey, getSurveyDetail, updateSurvey } from './surveys.api.js';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from './surveys.detail-form.js';
import {
  getSurveyEditorErrorMessage,
  mapSurveyItemToFormValues,
  toSurveyMutationInput,
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

const createSurveyEditorSubmit = (input: {
  readonly methods: UseFormReturn<SurveyDetailFormValues>;
  readonly leaveGuard: ReturnType<typeof useStudioEditorLeaveGuard>;
  readonly createdContentIdRef: Readonly<{ current: string | null }>;
  readonly rememberCreated: (id: string) => void;
  readonly mode: SurveyEditorMode;
  readonly contentId?: string;
  readonly loadedItem: SurveyContentItem | null;
  readonly actingPrincipalType: MainserverPrincipalType;
  readonly pt: SurveyEditorTranslation;
  readonly navigateToCreatedDetail: (contentId: string) => Promise<void>;
  readonly setLoadedItem: React.Dispatch<React.SetStateAction<SurveyContentItem | null>>;
  readonly setStatus: React.Dispatch<React.SetStateAction<SurveyEditorStatus>>;
  readonly saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}) =>
  input.methods.handleSubmit(
    async (values) => {
      if (input.mode === 'create' && input.createdContentIdRef.current !== null) return;
      const leaveRevision = input.leaveGuard.captureRevision();
      let operationId: number | null = null;
      try {
        if (input.mode === 'edit' && !input.contentId) {
          input.setStatus({ kind: 'error', text: input.pt('messages.missingContentId') });
          return;
        }
        if (input.mode === 'edit' && !input.loadedItem) {
          input.setStatus({ kind: 'error', text: input.pt('messages.loadError') });
          return;
        }

        operationId = input.saveFeedback.beginSaving();
        const mutation = toSurveyMutationInput(values, input.loadedItem);
        const contentId = input.contentId;
        const mutationResult =
          input.mode === 'create'
            ? await createSurvey(mutation, input.actingPrincipalType)
            : await updateSurvey(
                contentId as string,
                mutation,
                input.loadedItem ?? undefined,
                input.actingPrincipalType
              );
        const savedItem =
          input.mode === 'edit' && input.loadedItem?.results && mutationResult.results === undefined
            ? { ...mutationResult, results: input.loadedItem.results }
            : mutationResult;

        if (input.mode === 'create') input.rememberCreated(savedItem.id);
        input.setLoadedItem(savedItem);
        if (input.mode !== 'create') input.methods.reset(mapSurveyItemToFormValues(savedItem));
        else if (input.leaveGuard.acknowledgeSaved(leaveRevision))
          input.methods.reset(input.methods.getValues());
        input.setStatus(null);
        input.saveFeedback.markSaved(operationId);

        if (input.mode === 'create') {
          await input.navigateToCreatedDetail(savedItem.id);
        }
      } catch (error) {
        if (input.mode === 'create' && input.createdContentIdRef.current !== null) {
          input.setStatus({ kind: 'success', text: input.pt('messages.createdNavigationError') });
          return;
        }
        if (operationId !== null) {
          input.saveFeedback.markFailed(operationId);
        }
        input.setStatus({
          kind: 'error',
          text: getSurveyEditorErrorMessage(
            error,
            input.mode === 'create'
              ? input.pt('messages.createError')
              : input.pt('messages.updateError')
          ),
        });
      }
    },
    () => input.saveFeedback.reset()
  );

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
