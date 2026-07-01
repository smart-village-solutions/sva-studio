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

  React.useEffect(() => {
    if (mode !== 'edit') {
      setIsLoading(false);
      setLoadedItem(null);
      methods.reset(createDefaultSurveyDetailFormValues());
      return;
    }

    if (!contentId) {
      setStatus({ kind: 'error', text: pt('messages.missingContentId') });
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
  }, [contentId, methods, mode, pt]);

  const submit = methods.handleSubmit(async (values) => {
    try {
      const mutation = toSurveyMutationInput(values);
      const savedItem =
        mode === 'create'
          ? await createSurvey(mutation)
          : await updateSurvey(contentId as string, mutation);

      setLoadedItem(savedItem);
      methods.reset(mapSurveyItemToFormValues(savedItem));
      setStatus({
        kind: 'success',
        text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess'),
      });

      if (mode === 'create') {
        await navigateToContentList();
      }
    } catch (error) {
      setStatus({
        kind: 'error',
        text: getSurveyEditorErrorMessage(
          error,
          mode === 'create' ? pt('messages.createError') : pt('messages.updateError')
        ),
      });
    }
  });

  return { isLoading, loadedItem, status, submit };
};
