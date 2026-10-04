import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { NavigateFn } from '@tanstack/react-router';
import {
  contentMediaSavePhaseMessageKey,
  saveContentWithHostMediaReferences,
} from '@sva/plugin-sdk';
import {
  addStudioCreatedSaveFeedback,
  contentMediaUsageToReference,
  contentMediaUsagesToLocalDrafts,
  resolveContentMediaUsageDrafts,
  type ContentMediaUsage,
  type MainserverPrincipalType,
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { createGenericItem, updateGenericItem } from './generic-items.api.js';
import { genericItemMediaUsagesToContents } from './generic-items.content-media-adapter.js';
import { mapGenericItemsDetailFormValuesToInput } from './generic-items.detail-form.js';
import { genericItemsMediaReferenceTargetType } from './generic-items.detail-page.media-model.js';
import type { StatusMessage } from './generic-items.detail-page.logic.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const createSaveContent = ({
  values,
  mediaUsages,
  mode,
  actingPrincipalType,
  contentId,
}: Readonly<{
  values: GenericItemsDetailFormValues;
  mediaUsages: readonly ContentMediaUsage[];
  mode: 'create' | 'edit';
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
}>) => {
  return (
    draftResolutions: Parameters<typeof resolveContentMediaUsageDrafts>[1] = [],
    mediaSaveContext?: Readonly<{ operationId: string }>
  ) => {
    const input = {
      ...mapGenericItemsDetailFormValuesToInput(values),
      mediaContents: genericItemMediaUsagesToContents(
        resolveContentMediaUsageDrafts(mediaUsages, draftResolutions)
      ),
    };
    const mutationOptions = mediaSaveContext
      ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
      : undefined;
    if (mode === 'create') {
      return mutationOptions
        ? createGenericItem(input, actingPrincipalType, mutationOptions)
        : createGenericItem(input, actingPrincipalType);
    }
    return mutationOptions
      ? updateGenericItem(contentId ?? '', input, actingPrincipalType, mutationOptions)
      : updateGenericItem(contentId ?? '', input, actingPrincipalType);
  };
};

const saveWithOptionalReferences = async ({
  requiresReferenceSync,
  saveContent,
  mediaUsages,
  setMediaSavePhaseKey,
}: Readonly<{
  requiresReferenceSync: boolean;
  saveContent: ReturnType<typeof createSaveContent>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
}>) =>
  requiresReferenceSync
    ? await saveContentWithHostMediaReferences({
        fetch: globalThis.fetch.bind(globalThis),
        saveContent,
        getTargetId: (saved) => saved.id,
        targetType: genericItemsMediaReferenceTargetType,
        references: mediaUsages.flatMap((usage) => {
          const reference = contentMediaUsageToReference(usage);
          return reference ? [reference] : [];
        }),
        drafts: contentMediaUsagesToLocalDrafts(mediaUsages),
        onPhaseChange: (phase) => setMediaSavePhaseKey(contentMediaSavePhaseMessageKey(phase)),
      })
    : { status: 'complete' as const, saved: await saveContent(), resolutions: [] };

export const useGenericItemsPageSave = ({
  methods,
  canSave,
  mode,
  actingPrincipalType,
  contentId,
  mediaUsages,
  requiresReferenceSync,
  mediaReferenceSync,
  saveFeedback,
  setStatus,
  setMediaSavePhaseKey,
  navigate,
  pt,
}: Readonly<{
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  canSave: boolean;
  mode: 'create' | 'edit';
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
  mediaUsages: readonly ContentMediaUsage[];
  requiresReferenceSync: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
  navigate: NavigateFn;
  pt: (key: string) => string;
}>) => {
  const onSubmit = methods.handleSubmit(
    async (values) => {
      if (!canSave) return;
      setStatus(null);
      const operationId = saveFeedback.beginSaving();
      setMediaSavePhaseKey(null);
      try {
        const saveContent = createSaveContent({
          values,
          mediaUsages,
          mode,
          actingPrincipalType,
          contentId,
        });
        const result = await saveWithOptionalReferences({
          requiresReferenceSync,
          saveContent,
          mediaUsages,
          setMediaSavePhaseKey,
        });
        const handledResult = mediaReferenceSync.consumeSaveResult(result);
        if (handledResult.referenceFailed) {
          setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') });
          saveFeedback.markFailed(operationId);
          return;
        }
        setStatus(null);
        saveFeedback.markSaved(operationId);
        if (mode === 'create')
          await navigate({
            to: '/admin/generic-items/$id',
            params: { id: result.saved.id },
            state: (previous) =>
              addStudioCreatedSaveFeedback(previous, 'generic-items', result.saved.id),
          });
      } catch {
        setStatus({ kind: 'error', text: pt('messages.saveError') });
        saveFeedback.markFailed(operationId);
      }
    },
    () => saveFeedback.reset()
  );

  return onSubmit;
};
