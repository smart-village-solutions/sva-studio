import {
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import type { usePluginTranslation } from '@sva/plugin-sdk';
import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import type { NavigateOptions } from '@tanstack/react-router';
import type { UseFormReturn } from 'react-hook-form';
import type { MainserverPrincipalType } from '@sva/studio-ui-react';
import {
  addStudioCreatedSaveFeedback,
  addStudioDestructiveNavigationFeedback,
} from '@sva/studio-ui-react';
import * as React from 'react';

import { createFaq, deleteFaq, FaqApiError, getFaqDetail, updateFaq } from './faq.api.js';
import { mapFaqFormValuesToGenericItemInput, mapGenericItemToFaqFormValues } from './faq.model.js';
import type { FaqFormValues } from './faq.types.js';

type Translation = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
type Navigate = (options: NavigateOptions) => Promise<unknown>;

const resolveSaveErrorMessage = (error: unknown, pt: Translation) =>
  error instanceof FaqApiError && error.message.trim()
    ? pt('messages.saveErrorWithReason', { reason: error.message })
    : pt('messages.saveError');

const resolveDeleteErrorMessage = (error: unknown, pt: Translation) =>
  error instanceof FaqApiError && error.message.trim()
    ? pt('messages.deleteErrorWithReason', { reason: error.message })
    : pt('messages.deleteError');

export const useFaqEditorLoader = ({
  contentId,
  form,
  mode,
  actingPrincipalType,
}: Readonly<{
  contentId?: string;
  form: UseFormReturn<FaqFormValues>;
  mode: 'create' | 'edit';
  actingPrincipalType: MainserverPrincipalType;
}>) => {
  const [existingPayload, setExistingPayload] = React.useState<unknown>();
  const [loadedItem, setLoadedItem] = React.useState<
    Awaited<ReturnType<typeof getFaqDetail>>['data'] | null
  >(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const loadedContentIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (mode !== 'edit') {
      loadedContentIdRef.current = undefined;
      return;
    }
    const refreshesAccessOnly = loadedContentIdRef.current === contentId;
    if (!refreshesAccessOnly) {
      setExistingPayload(undefined);
      setLoadedItem(null);
      setLoadError(false);
      setLoading(true);
    }
    if (!contentId) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    let active = true;
    void getFaqDetail(contentId, actingPrincipalType)
      .then((detail) => {
        if (active) {
          setResourceAccess(detail.access);
          if (refreshesAccessOnly) return;
          const item = detail.data;
          form.reset(mapGenericItemToFaqFormValues(item));
          setExistingPayload(item.payload);
          setLoadedItem(item);
          loadedContentIdRef.current = contentId;
        }
      })
      .catch(() => {
        if (!active) return;
        if (refreshesAccessOnly) setResourceAccess({});
        else setLoadError(true);
      })
      .finally(() => active && !refreshesAccessOnly && setLoading(false));
    return () => {
      active = false;
    };
  }, [actingPrincipalType, contentId, form, mode]);

  return { existingPayload, loadedItem, loadError, loading, resourceAccess };
};

export const useFaqEditorActions = ({
  contentId,
  existingPayload,
  mode,
  navigate,
  pt,
  setDeleteErrorMessage,
  setSaveErrorMessage,
  actingPrincipalType,
  onCreateStarted,
  onCreateSaved,
}: Readonly<{
  contentId?: string;
  existingPayload: unknown;
  onCreateStarted: () => boolean;
  onCreateSaved: (id: string) => void;
  mode: 'create' | 'edit';
  navigate: Navigate;
  pt: Translation;
  setDeleteErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setSaveErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  actingPrincipalType: MainserverPrincipalType;
}>) => {
  const [deletePending, setDeletePending] = React.useState(false);

  const onSubmit = async (values: FaqFormValues) => {
    setSaveErrorMessage(null);
    try {
      const input = mapFaqFormValuesToGenericItemInput(values, existingPayload);
      if (mode === 'create') {
        if (!onCreateStarted()) return false;
        const item = await createFaq(input, actingPrincipalType);
        onCreateSaved(item.id);
        try {
          await navigate({
            to: '/admin/faq/$id',
            params: { id: item.id },
            state: (previous) => addStudioCreatedSaveFeedback(previous, 'faq', item.id),
          });
        } catch {
          setSaveErrorMessage(pt('create.navigationFailed'));
        }
      } else if (contentId) {
        await updateFaq(contentId, input, actingPrincipalType);
      }
      return true;
    } catch (error) {
      setSaveErrorMessage(resolveSaveErrorMessage(error, pt));
      return false;
    }
  };

  const onDelete = async () => {
    if (!contentId) return false;
    setDeleteErrorMessage(null);
    setDeletePending(true);
    try {
      await deleteFaq(contentId, actingPrincipalType);
    } catch (error) {
      setDeleteErrorMessage(resolveDeleteErrorMessage(error, pt));
      setDeletePending(false);
      return false;
    }

    try {
      await navigate({
        to: '/admin/content',
        state: (previous) => addStudioDestructiveNavigationFeedback(previous, 'faq', contentId),
      });
    } catch {
      return true;
    } finally {
      setDeletePending(false);
    }
    return true;
  };

  return { deletePending, onDelete, onSubmit };
};

export function useFaqCreateGuard(mode: 'create' | 'edit', form: UseFormReturn<FaqFormValues>) {
  const [createdContentId, setCreatedContentId] = React.useState<string | null>(null);
  const savedRevision = React.useRef(0);
  const createdContentIdRef = React.useRef<string | null>(null);
  const leaveGuard = useStudioEditorLeaveGuard({
    enabled: mode === 'create',
    hasUnsavedChanges: form.formState.isDirty,
  });
  React.useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if (name) leaveGuard.markChanged();
    });
    return () => subscription.unsubscribe();
  }, [form, leaveGuard]);
  const onCreateStarted = () => {
    if (createdContentIdRef.current) return false;
    savedRevision.current = leaveGuard.captureRevision();
    return true;
  };
  const onCreateConfirmed = (id: string) => {
    createdContentIdRef.current = id;
    setCreatedContentId(id);
  };
  const onCreateSaved = (id: string) => {
    onCreateConfirmed(id);

    if (leaveGuard.acknowledgeSaved(savedRevision.current)) form.reset(form.getValues());
  };

  return { createdContentId, onCreateStarted, onCreateSaved };
}

export const useFaqInitialSaveFeedback = ({
  contentId,
  loading,
  locationState,
  navigate,
  saveFeedback,
}: Readonly<{
  contentId?: string;
  loading: boolean;
  locationState: unknown;
  navigate: ReturnType<typeof useNavigate>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}>) => {
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (
      loading ||
      shownRef.current ||
      !hasStudioCreatedSaveFeedback(locationState, 'faq', contentId)
    ) {
      return;
    }

    shownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/faq/$id',
      params: { id: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [contentId, loading, locationState, navigate, saveFeedback]);
};
