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
import { createPoi, updatePoi, PoiApiError } from './poi.api.js';
import {
  mapPoiDetailFormValuesToInput,
  parsePoiPayloadText,
  type PoiDetailFormValues,
} from './poi.detail-form.js';
import type { PoiDetailTabId } from './poi.detail-tabs.js';
import { poiMediaUsagesToContents } from './poi.content-media-adapter.js';
import { validatePoiSubmission } from './poi.detail-page.validation.js';

export type PoiStatusMessage = Readonly<{ kind: 'success' | 'error'; text: string }>;

const deviationFormPaths: Readonly<
  Record<string, Parameters<UseFormReturn<PoiDetailFormValues>['getFieldState']>[0]>
> = {
  name: 'name',
  categories: 'basis.categories',
  active: 'basis.active',
  description: 'content.description',
  mobileDescription: 'content.mobileDescription',
  addresses: 'content.addresses',
  location: 'content.location',
  contact: 'content.contact',
  openingHours: 'content.openingHours',
  webUrls: 'content.webUrls',
  operatingCompany: 'content.operator',
  priceInformations: 'content.prices',
  mediaContents: 'content.mediaContents',
  certificates: 'content.certificates',
  accessibilityInformation: 'content.accessibilityInformation',
  tags: 'content.tagsText',
  payload: 'content.payloadText',
  externalId: 'settings.externalId',
  keywords: 'settings.keywords',
};

type SaveInput = Readonly<{
  methods: UseFormReturn<PoiDetailFormValues>;
  canSave: boolean;
  mode: 'create' | 'edit';
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
  instanceId?: string;
  mediaUsages: readonly ContentMediaUsage[];
  requiresReferenceSync: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setStatus: Dispatch<SetStateAction<PoiStatusMessage | null>>;
  setMediaSavePhaseKey: Dispatch<SetStateAction<string | null>>;
  setActiveTab: (tab: PoiDetailTabId) => void;
  focusFieldById: (id: string) => void;
  deviations: readonly { fieldGroup: string }[];
  deviationFieldLabels: Readonly<Record<string, string>>;
  navigate: NavigateFn;
  pt: ReturnType<typeof usePluginTranslation>;
}>;

const confirmDegradedCorrection = ({
  methods,
  deviations,
  deviationFieldLabels,
  pt,
}: SaveInput) => {
  const correctedDegradedFields = deviations
    .map(({ fieldGroup }) => fieldGroup)
    .filter((fieldGroup) => {
      const fieldPath = deviationFormPaths[fieldGroup];
      return fieldPath ? methods.getFieldState(fieldPath).isDirty : false;
    });
  if (
    correctedDegradedFields.length > 0 &&
    !globalThis.confirm(
      pt('messages.degradedCorrectionConfirm', {
        fields: correctedDegradedFields
          .map((field) => deviationFieldLabels[field] ?? field)
          .join(', '),
      })
    )
  ) {
    return null;
  }
  return correctedDegradedFields;
};

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

export const usePoiDetailSave = (input: SaveInput) => {
  const {
    methods,
    canSave,
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
  return methods.handleSubmit(async (values) => {
    if (!canSave) return;
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
      const handledResult = mediaReferenceSync.consumeSaveResult(result);
      const saved = handledResult.saved;
      if (handledResult.referenceFailed) {
        setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') });
        saveFeedback.markFailed(operationId);
        return;
      }
      setStatus(null);
      saveFeedback.markSaved(operationId);
      if (mode === 'create') {
        await navigate({
          to: '/admin/poi/$id',
          params: { id: saved.id },
          state: (previous) => addStudioCreatedSaveFeedback(previous, 'poi', saved.id),
        });
      }
    } catch (saveError) {
      setStatus({
        kind: 'error',
        text: saveError instanceof PoiApiError ? saveError.message : pt('messages.saveError'),
      });
      saveFeedback.markFailed(operationId);
    }
  });
};
