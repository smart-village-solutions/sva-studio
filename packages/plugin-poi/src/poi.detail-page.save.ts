import type { usePoiDetailMedia } from './poi.detail-page.media.js';
import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { type NavigateFn } from '@tanstack/react-router';
import {
  contentMediaSavePhaseMessageKey,
  omitDeviatedMainserverFields,
  saveContentWithHostMediaReferences,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  addStudioCreatedSaveFeedback,
  contentMediaUsagesToLocalDrafts,
  resolveContentMediaUsageDrafts,
  type ContentMediaUsage,
  type MainserverPrincipalType,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import {
  createPoi,
  updatePoi,
  setPoiVisibility,
  PoiApiError,
  readPoiVisibilityFailureContentId,
} from './poi.api.js';
import {
  mapPoiDetailFormValuesToInput,
  parsePoiPayloadText,
  type PoiDetailFormValues,
} from './poi.detail-form.js';
import type { PoiDetailTabId } from './poi.detail-tabs.js';
import { poiMediaUsagesToContents } from './poi.content-media-adapter.js';
import type { PoiContentItem } from './poi.types.js';
import { confirmDegradedCorrection, validatePoiSubmission } from './poi.detail-page.validation.js';

const poiSaveErrorMessage = (saveError: unknown, pt: (key: string) => string) =>
  saveError instanceof PoiApiError
    ? ['missing_credentials', 'organization_mainserver_credentials_missing'].includes(
        saveError.code
      )
      ? pt('create.saveUnavailable')
      : saveError.message
    : pt('messages.saveError');

export type PoiStatusMessage = Readonly<{ kind: 'success' | 'error'; text: string }>;

type SaveInput = Readonly<{
  methods: UseFormReturn<PoiDetailFormValues>;
  canSave: boolean;
  leaveGuard: ReturnType<typeof usePoiDetailMedia>['leaveGuard'];
  mode: 'create' | 'edit';
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
  instanceId?: string;
  mediaUsages: readonly ContentMediaUsage[];
  mediaDirty: boolean;
  requiresReferenceSync: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setLoadedItem: Dispatch<SetStateAction<PoiContentItem | null>>;
  setStatus: Dispatch<SetStateAction<PoiStatusMessage | null>>;
  setMediaSavePhaseKey: Dispatch<SetStateAction<string | null>>;
  setActiveTab: (tab: PoiDetailTabId) => void;
  focusFieldById: (id: string) => void;
  deviations: readonly { fieldGroup: string }[];
  deviationFieldLabels: Readonly<Record<string, string>>;
  navigate: NavigateFn;
  pt: ReturnType<typeof usePluginTranslation>;
}>;

const createPoiSaveContent = (
  { mode, contentId, actingPrincipalType, mediaUsages, deviations }: SaveInput,
  values: PoiDetailFormValues,
  payload: Exclude<ReturnType<typeof parsePoiPayloadText>, undefined>,
  correctedDegradedFields: readonly string[]
) => {
  return (
    draftResolutions: Parameters<typeof resolveContentMediaUsageDrafts>[1] = [],
    mediaSaveContext?: Readonly<{ operationId: string }>
  ) => {
    const resolvedMutation = mapPoiDetailFormValuesToInput(
      {
        ...values,
        content: {
          ...values.content,
          mediaContents: poiMediaUsagesToContents(
            resolveContentMediaUsageDrafts(mediaUsages, draftResolutions)
          ),
        },
      },
      payload
    );
    const mutationOptions = mediaSaveContext
      ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
      : undefined;
    if (mode === 'create') {
      return mutationOptions
        ? createPoi(resolvedMutation, actingPrincipalType, mutationOptions)
        : createPoi(resolvedMutation, actingPrincipalType);
    }
    const mutation = omitDeviatedMainserverFields(resolvedMutation, deviations, {
      retainedFieldGroups: correctedDegradedFields,
    });
    return mutationOptions
      ? updatePoi(contentId as string, mutation, actingPrincipalType, mutationOptions)
      : updatePoi(contentId as string, mutation, actingPrincipalType);
  };
};

const savePoiWithMedia = async (
  { requiresReferenceSync, instanceId, mediaUsages, setMediaSavePhaseKey }: SaveInput,
  saveContent: ReturnType<typeof createPoiSaveContent>
) => {
  return requiresReferenceSync
    ? await saveContentWithHostMediaReferences({
        fetch: globalThis.fetch.bind(globalThis),
        saveContent,
        getTargetId: (saved) => saved.id,
        targetType: 'poi.point-of-interest',
        instanceId,
        references: mediaUsages.flatMap((usage) =>
          usage.assetId
            ? [{ assetId: usage.assetId, role: 'gallery_item', sortOrder: usage.sortOrder }]
            : []
        ),
        drafts: contentMediaUsagesToLocalDrafts(mediaUsages),
        onPhaseChange: (phase) => setMediaSavePhaseKey(contentMediaSavePhaseMessageKey(phase)),
      })
    : { status: 'complete' as const, saved: await saveContent(), resolutions: [] };
};

const submitPoi = async (input: SaveInput, values: PoiDetailFormValues) => {
  const {
    methods,
    mode,
    mediaUsages,
    mediaReferenceSync,
    saveFeedback,
    setStatus,
    setMediaSavePhaseKey,
    setActiveTab,
    focusFieldById,
    navigate,
    pt,
  } = input;
  methods.clearErrors();
  setStatus(null);
  const validation = validatePoiSubmission({
    methods,
    values,
    mediaUsages,
    setActiveTab,
    focusFieldById,
  });
  if (!validation.valid) {
    if (!('payloadError' in validation)) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
    }
    return;
  }
  const payload = validation.payload;
  const leaveRevision = input.leaveGuard.captureRevision();
  const operationId = saveFeedback.beginSaving();
  setMediaSavePhaseKey(null);
  try {
    const correctedDegradedFields = confirmDegradedCorrection(input);
    if (!correctedDegradedFields) {
      saveFeedback.reset();
      return;
    }
    const saveContent = createPoiSaveContent(input, values, payload, correctedDegradedFields);
    const result = await savePoiWithMedia(input, saveContent);
    if (mode === 'create') input.leaveGuard.rememberCreated(result.saved.id);
    const handledResult = mediaReferenceSync.consumeSaveResult(result);
    const saved = handledResult.saved;
    if (handledResult.referenceFailed) {
      input.leaveGuard.rememberPartialSave(leaveRevision);
      setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') });
      saveFeedback.markFailed(operationId);
      return;
    }
    setStatus(null);
    saveFeedback.markSaved(operationId);
    if (mode === 'create') {
      input.leaveGuard.acknowledgeSaved(leaveRevision);
      await navigate({
        to: '/admin/poi/$id',
        params: { id: saved.id },
        state: (previous) => addStudioCreatedSaveFeedback(previous, 'poi', saved.id),
      });
    }
  } catch (saveError) {
    const savedContentId = readPoiVisibilityFailureContentId(saveError);
    if (savedContentId) {
      input.leaveGuard.rememberCreated(savedContentId);
      setStatus({ kind: 'error', text: pt('messages.visibilityPartialFailure') });
      saveFeedback.markFailed(operationId);
      return;
    }
    if (mode === 'create' && input.leaveGuard.hasCreated()) {
      setStatus({ kind: 'success', text: pt('messages.createdNavigationError') });
      return;
    }
    setStatus({ kind: 'error', text: poiSaveErrorMessage(saveError, pt) });
    saveFeedback.markFailed(operationId);
  }
};

const isVisibilityOnlyChange = (input: SaveInput, values: PoiDetailFormValues): boolean => {
  const defaults = input.methods.formState.defaultValues;
  return (
    input.mode === 'edit' &&
    defaults?.basis?.active !== undefined &&
    defaults.basis.active !== values.basis.active &&
    !input.mediaDirty &&
    !input.mediaReferenceSync.hasPendingRetry &&
    JSON.stringify({ ...defaults, basis: { ...defaults.basis, active: values.basis.active } }) ===
      JSON.stringify(values)
  );
};

const savePoiVisibility = async (input: SaveInput, contentId: string, visible: boolean) => {
  const { methods, saveFeedback, setStatus, pt } = input;
  methods.clearErrors();
  setStatus(null);
  const operationId = saveFeedback.beginSaving();
  try {
    await setPoiVisibility(contentId, visible, input.actingPrincipalType);
    const currentVisibility = methods.getValues('basis.active');
    methods.resetField('basis.active', { defaultValue: visible });
    if (currentVisibility !== visible) {
      methods.setValue('basis.active', currentVisibility, { shouldDirty: true });
    }
    input.setLoadedItem((item) => (item?.id === contentId ? { ...item, visible } : item));
    saveFeedback.markSaved(operationId);
  } catch (error) {
    setStatus({ kind: 'error', text: poiSaveErrorMessage(error, pt) });
    saveFeedback.markFailed(operationId);
  }
};

export const usePoiDetailSave = (input: SaveInput) =>
  input.methods.handleSubmit((values) => {
    if (!input.canSave || (input.mode === 'create' && input.leaveGuard.hasCreated())) return;
    return input.contentId && isVisibilityOnlyChange(input, values)
      ? savePoiVisibility(input, input.contentId, values.basis.active)
      : submitPoi(input, values);
  });
