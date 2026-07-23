import type { NavigateOptions } from '@tanstack/react-router';
import type { UseFormReturn } from 'react-hook-form';
import * as React from 'react';

import { createFaq, deleteFaq, FaqApiError, getFaq, updateFaq } from './faq.api.js';
import { mapFaqFormValuesToGenericItemInput, mapGenericItemToFaqFormValues } from './faq.model.js';
import type { FaqFormValues } from './faq.types.js';

type Translation = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
type Navigate = (options: NavigateOptions) => Promise<unknown>;

const resolveSaveErrorMessage = (error: unknown, pt: Translation) =>
  error instanceof FaqApiError && error.message.trim()
    ? pt('messages.saveErrorWithReason', { reason: error.message })
    : pt('messages.saveError');

export const useFaqEditorLoader = ({ contentId, form, mode }: Readonly<{
  contentId?: string;
  form: UseFormReturn<FaqFormValues>;
  mode: 'create' | 'edit';
}>) => {
  const [existingPayload, setExistingPayload] = React.useState<unknown>();
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(mode === 'edit');

  React.useEffect(() => {
    if (mode !== 'edit') return;
    if (!contentId) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    let active = true;
    void getFaq(contentId)
      .then((item) => {
        if (active) {
          form.reset(mapGenericItemToFaqFormValues(item));
          setExistingPayload(item.payload);
        }
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [contentId, form, mode]);

  return { existingPayload, loadError, loading };
};

export const useFaqEditorActions = ({ contentId, existingPayload, form, mode, navigate, pt, setSaveErrorMessage }: Readonly<{
  contentId?: string;
  existingPayload: unknown;
  form: UseFormReturn<FaqFormValues>;
  mode: 'create' | 'edit';
  navigate: Navigate;
  pt: Translation;
  setSaveErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
}>) => {
  const [deletePending, setDeletePending] = React.useState(false);

  const onSubmit = async (values: FaqFormValues) => {
    setSaveErrorMessage(null);
    try {
      const input = mapFaqFormValuesToGenericItemInput(values, existingPayload);
      if (mode === 'create') {
        const item = await createFaq(input);
        await navigate({ to: '/admin/faq/$id', params: { id: item.id } });
      } else if (contentId) {
        await updateFaq(contentId, input);
      }
    } catch (error) {
      setSaveErrorMessage(resolveSaveErrorMessage(error, pt));
    }
  };

  const onDelete = async () => {
    if (!contentId) return;
    setDeletePending(true);
    try {
      await deleteFaq(contentId);
      await navigate({ to: '/admin/content' });
    } catch (error) {
      setSaveErrorMessage(resolveSaveErrorMessage(error, pt));
    } finally {
      setDeletePending(false);
    }
  };

  return { deletePending, onDelete, onSubmit };
};
