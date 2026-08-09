import React from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useStudioSaveFeedback, type MainserverPrincipalType } from '@sva/studio-ui-react';

import { createSurvey, getSurvey, updateSurvey } from './surveys.api.js';
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

const useSurveyEditorLoader = ({
  mode,
  contentId,
  methods,
  pt,
  setStatus,
  setIsLoading,
  setLoadedItem,
}: Readonly<{
  mode: SurveyEditorMode;
  contentId?: string;
  methods: UseFormReturn<SurveyDetailFormValues>;
  pt: SurveyEditorTranslation;
  setStatus: React.Dispatch<React.SetStateAction<SurveyEditorStatus>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadedItem: React.Dispatch<React.SetStateAction<SurveyContentItem | null>>;
}>) => {
  React.useEffect(() => {
    if (mode !== 'edit') {
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
    setIsLoading(true);
    setStatus(null);

    void getSurvey(contentId)
      .then((item) => {
        if (cancelled) {
          return;
        }
        setLoadedItem(item);
        methods.reset(mapSurveyItemToFormValues(item));
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadedItem(null);
          methods.reset(createDefaultSurveyDetailFormValues());
          setStatus({
            kind: 'error',
            text: getSurveyEditorErrorMessage(error, pt('messages.loadError')),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [contentId, methods, mode, pt, setIsLoading, setLoadedItem, setStatus]);
};

const createSurveyEditorSubmit = (input: {
  readonly methods: UseFormReturn<SurveyDetailFormValues>;
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

        input.setLoadedItem(savedItem);
        input.methods.reset(mapSurveyItemToFormValues(savedItem));
        input.setStatus(null);
        input.saveFeedback.markSaved(operationId);

        if (input.mode === 'create') {
          await input.navigateToCreatedDetail(savedItem.id);
        }
      } catch (error) {
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
  const saveFeedback = useStudioSaveFeedback();
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (methods.formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [methods.formState.isDirty, saveFeedback.markDirty]);
  useSurveyEditorLoader({ mode, contentId, methods, pt, setStatus, setIsLoading, setLoadedItem });
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

  return { isLoading, loadedItem, saveStatus: saveFeedback.status, status, submit };
};
