import React from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { createSurvey, getSurvey, updateSurvey } from './surveys.api.js';
import { createDefaultSurveyDetailFormValues, type SurveyDetailFormValues } from './surveys.detail-form.js';
import {
  getSurveyEditorErrorMessage,
  mapSurveyItemToFormValues,
  toSurveyMutationInput,
  type SurveyEditorMode,
} from './surveys.editor.shared.js';
import type { SurveyContentItem } from './surveys.types.js';

export type SurveyEditorStatus =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string }
  | null;

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
          setStatus({ kind: 'error', text: getSurveyEditorErrorMessage(error, pt('messages.loadError')) });
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
  readonly pt: SurveyEditorTranslation;
  readonly navigateToContentList: () => Promise<void>;
  readonly setLoadedItem: React.Dispatch<React.SetStateAction<SurveyContentItem | null>>;
  readonly setStatus: React.Dispatch<React.SetStateAction<SurveyEditorStatus>>;
}) =>
  input.methods.handleSubmit(async (values) => {
    try {
      if (input.mode === 'edit' && !input.contentId) {
        input.setStatus({ kind: 'error', text: input.pt('messages.missingContentId') });
        return;
      }

      const mutation = toSurveyMutationInput(values, input.loadedItem);
      const contentId = input.contentId;
      const mutationResult =
        input.mode === 'create'
          ? await createSurvey(mutation)
          : await updateSurvey(contentId as string, mutation);
      const savedItem =
        input.mode === 'edit' && input.loadedItem?.results && mutationResult.results === undefined
          ? { ...mutationResult, results: input.loadedItem.results }
          : mutationResult;

      input.setLoadedItem(savedItem);
      input.methods.reset(mapSurveyItemToFormValues(savedItem));
      input.setStatus({
        kind: 'success',
        text: input.mode === 'create' ? input.pt('messages.createSuccess') : input.pt('messages.updateSuccess'),
      });

      if (input.mode === 'create') {
        await input.navigateToContentList();
      }
    } catch (error) {
      input.setStatus({
        kind: 'error',
        text: getSurveyEditorErrorMessage(
          error,
          input.mode === 'create' ? input.pt('messages.createError') : input.pt('messages.updateError')
        ),
      });
    }
  });

export const useSurveyEditorController = ({
  mode,
  contentId,
  methods,
  pt,
  navigateToContentList,
}: Readonly<{
  mode: SurveyEditorMode;
  contentId?: string;
  methods: UseFormReturn<SurveyDetailFormValues>;
  pt: SurveyEditorTranslation;
  navigateToContentList: () => Promise<void>;
}>) => {
  const [status, setStatus] = React.useState<SurveyEditorStatus>(null);
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [loadedItem, setLoadedItem] = React.useState<SurveyContentItem | null>(null);
  useSurveyEditorLoader({ mode, contentId, methods, pt, setStatus, setIsLoading, setLoadedItem });
  const submit = createSurveyEditorSubmit({
    methods,
    mode,
    contentId,
    loadedItem,
    pt,
    navigateToContentList,
    setLoadedItem,
    setStatus,
  });

  return { isLoading, loadedItem, status, submit };
};
