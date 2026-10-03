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
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import type * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { createCockpitCard, getCockpitCard, updateCockpitCard } from './cockpit-cards.api.js';
import { COCKPIT_CARD_CONTENT_TYPE } from './cockpit-cards.constants.js';
import { cockpitCardUsagesToMedia } from './cockpit-cards.content-media-adapter.js';
import { mapCockpitCardFormValuesToGenericItemInput } from './cockpit-cards.model.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';
import type { MainserverPrincipalType } from '@sva/studio-ui-react';

type SavedItem = Awaited<ReturnType<typeof getCockpitCard>>;
type SaveContext = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  loadedItem: SavedItem | null;
  mediaUsages: readonly ContentMediaUsage[];
  requiresReferenceSync: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  navigate: ReturnType<typeof useNavigate>;
  pt: (key: string) => string;
  setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
  setMutationError: React.Dispatch<React.SetStateAction<string | null>>;
}>;

async function saveContent(
  values: CockpitCardFormValues,
  context: SaveContext,
  partial: { failed: boolean },
  draftResolutions: Parameters<typeof resolveContentMediaUsageDrafts>[1] = [],
  mediaSaveContext?: Readonly<{ operationId: string }>
) {
  const input = mapCockpitCardFormValuesToGenericItemInput(
    {
      ...values,
      images: [
        ...cockpitCardUsagesToMedia(
          resolveContentMediaUsageDrafts(context.mediaUsages, draftResolutions)
        ),
      ],
    },
    context.loadedItem ?? undefined
  );
  const mutationOptions = mediaSaveContext
    ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
    : undefined;
  if (context.mode === 'create')
    return mutationOptions
      ? createCockpitCard(input, context.actingPrincipalType, mutationOptions)
      : createCockpitCard(input, context.actingPrincipalType);
  try {
    return await (mutationOptions
      ? updateCockpitCard(
          context.contentId as string,
          input,
          context.actingPrincipalType,
          mutationOptions
        )
      : updateCockpitCard(context.contentId as string, input, context.actingPrincipalType));
  } catch (cause) {
    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === 'visibility_update_failed' &&
      context.loadedItem
    ) {
      partial.failed = true;
      return context.loadedItem;
    }
    throw cause;
  }
}

export async function saveCockpitCard(values: CockpitCardFormValues, context: SaveContext) {
  const { mediaUsages, saveFeedback, setMutationError, pt } = context;
  setMutationError(null);
  const operationId = saveFeedback.beginSaving();
  context.setMediaSavePhaseKey(null);
  try {
    const partial = { failed: false };
    const save = (
      drafts?: Parameters<typeof resolveContentMediaUsageDrafts>[1],
      mediaContext?: Readonly<{ operationId: string }>
    ) => saveContent(values, context, partial, drafts, mediaContext);
    const result = context.requiresReferenceSync
      ? await saveContentWithHostMediaReferences({
          fetch: globalThis.fetch.bind(globalThis),
          saveContent: save,
          getTargetId: (saved) => saved.id,
          targetType: COCKPIT_CARD_CONTENT_TYPE,
          references: mediaUsages.flatMap((usage) => {
            const reference = contentMediaUsageToReference(usage);
            return reference ? [reference] : [];
          }),
          drafts: contentMediaUsagesToLocalDrafts(mediaUsages),
          onPhaseChange: (phase) =>
            context.setMediaSavePhaseKey(contentMediaSavePhaseMessageKey(phase)),
        })
      : { status: 'complete' as const, saved: await save(), resolutions: [] };
    const handledResult = context.mediaReferenceSync.consumeSaveResult(result);
    if (handledResult.referenceFailed || partial.failed) {
      setMutationError(
        pt(
          handledResult.referenceFailed
            ? 'messages.mediaReferencePartialFailure'
            : 'messages.visibilitySavePartialFailure'
        )
      );
      saveFeedback.markFailed(operationId);
      return;
    }
    saveFeedback.markSaved(operationId);
    if (context.mode === 'create')
      await context.navigate({
        to: '/admin/cockpit-cards/$id',
        params: { id: result.saved.id },
        state: (previous) =>
          addStudioCreatedSaveFeedback(previous, 'cockpit-cards', result.saved.id),
      });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : '';
    setMutationError(
      cause instanceof Error && 'code' in cause && cause.code === 'visibility_update_failed'
        ? pt('messages.visibilitySavePartialFailure')
        : reason
          ? pt('messages.saveErrorWithReason').replace('{{reason}}', reason)
          : pt('messages.saveError')
    );
    saveFeedback.markFailed(operationId);
  }
}

export function cockpitCardValidationTab(
  errors: Partial<Record<keyof CockpitCardFormValues, unknown>>
) {
  if (errors.text || errors.images) return 'content';
  if (errors.link || errors.sortWeight) return 'settings';
  return 'basis';
}

export function cockpitCardSummaryErrors(
  form: UseFormReturn<CockpitCardFormValues>,
  pt: (key: string) => string
) {
  return [
    form.formState.errors.heading
      ? { field: 'cockpit-card-heading', message: pt('validation.required') }
      : null,
    form.formState.errors.languageCode
      ? { field: 'cockpit-card-language', message: pt('validation.languageCode') }
      : null,
    form.formState.errors.category
      ? { field: 'cockpit-card-category', message: pt('validation.required') }
      : null,
    form.formState.errors.text
      ? { field: 'cockpit-card-text', message: pt('validation.plainText') }
      : null,
    form.formState.errors.images
      ? { field: 'cockpit-card-image-0', message: pt('validation.images') }
      : null,
    form.formState.errors.link
      ? { field: 'cockpit-card-link', message: pt('validation.link') }
      : null,
    form.formState.errors.sortWeight
      ? { field: 'cockpit-card-weight', message: pt('validation.sortWeight') }
      : null,
  ].filter((entry): entry is { field: string; message: string } => entry !== null);
}
