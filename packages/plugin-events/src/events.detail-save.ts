import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useNavigate } from '@tanstack/react-router';
import {
  contentMediaSavePhaseMessageKey,
  omitDeviatedMainserverFields,
  saveContentWithHostMediaReferences,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  addStudioCreatedSaveFeedback,
  contentMediaUsageToReference,
  contentMediaUsagesToLocalDrafts,
  contentMediaUsagesToMainserver,
  resolveContentMediaUsageDrafts,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { createEvent, updateEvent, EventsApiError } from './events.api.js';
import { EVENTS_CONTENT_TYPE } from './events.constants.js';
import {
  mapEventsDetailFormValuesToInput,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import type { EventsDetailTabId } from './events.detail-tabs.js';
import { validateEventsDetailSubmission } from './events.detail-save-validation.js';

export type EventsStatusMessage = Readonly<{ kind: 'success' | 'error'; text: string }>;
export const eventsErrorMessage = (
  pt: ReturnType<typeof usePluginTranslation>,
  error: unknown,
  fallbackKey: string
) => (error instanceof EventsApiError ? error.message : pt(fallbackKey));

type SaveContext = Readonly<{
  methods: UseFormReturn<EventsDetailFormValues>;
  canSave: boolean;
  mediaUsages: readonly ContentMediaUsage[];
  setStatus: Dispatch<SetStateAction<EventsStatusMessage | null>>;
  pt: ReturnType<typeof usePluginTranslation>;
  setActiveTab: Dispatch<SetStateAction<EventsDetailTabId>>;
  setPendingFocusId: Dispatch<SetStateAction<string | null>>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setMediaSavePhaseKey: Dispatch<SetStateAction<string | null>>;
  deviations: readonly { fieldGroup: string }[];
  deviationFieldLabels: Readonly<Record<string, string>>;
  mode: 'create' | 'edit';
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
  requiresReferenceSync: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  navigate: ReturnType<typeof useNavigate>;
}>;

const correctedDegradedFields = (context: SaveContext) => {
  const paths: Readonly<Record<string, Parameters<typeof context.methods.getFieldState>[0]>> = {
    title: 'title',
    categories: 'basis.categories',
    description: 'content.description',
    dates: 'content.dates',
    addresses: 'content.addresses',
    contacts: 'content.contacts',
    urls: 'content.urls',
    mediaContents: 'content.mediaContents',
    organizer: 'content.organizer',
    priceInformations: 'content.priceInformations',
    accessibilityInformation: 'content.accessibilityInformation',
    externalId: 'settings.externalId',
    keywords: 'settings.keywords',
    tags: 'settings.tags',
    visible: 'settings.visible',
  };
  return context.deviations
    .map(({ fieldGroup }) => fieldGroup)
    .filter((fieldGroup) => {
      const fieldPath = paths[fieldGroup];
      return fieldPath ? context.methods.getFieldState(fieldPath).isDirty : false;
    });
};

const createSaveContent =
  (context: SaveContext, values: EventsDetailFormValues, correctedFields: readonly string[]) =>
  (
    draftResolutions: Parameters<typeof resolveContentMediaUsageDrafts>[1] = [],
    mediaSaveContext?: Readonly<{ operationId: string }>
  ) => {
    const payload = mapEventsDetailFormValuesToInput({
      ...values,
      content: {
        ...values.content,
        mediaContents: contentMediaUsagesToMainserver(
          resolveContentMediaUsageDrafts(context.mediaUsages, draftResolutions)
        ) as EventsDetailFormValues['content']['mediaContents'],
      },
    });
    const mutationOptions = mediaSaveContext
      ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
      : undefined;
    if (context.mode === 'create') {
      return mutationOptions
        ? createEvent(payload, context.actingPrincipalType, mutationOptions)
        : createEvent(payload, context.actingPrincipalType);
    }
    const mutation = omitDeviatedMainserverFields(payload, context.deviations, {
      retainedFieldGroups: correctedFields,
    });
    return mutationOptions
      ? updateEvent(
          context.contentId as string,
          mutation,
          context.actingPrincipalType,
          mutationOptions
        )
      : updateEvent(context.contentId as string, mutation, context.actingPrincipalType);
  };

const persistWithMedia = async (
  context: SaveContext,
  saveContent: ReturnType<typeof createSaveContent>
) =>
  context.requiresReferenceSync
    ? saveContentWithHostMediaReferences({
        fetch: globalThis.fetch.bind(globalThis),
        saveContent,
        getTargetId: (saved) => saved.id,
        targetType: EVENTS_CONTENT_TYPE,
        references: context.mediaUsages.flatMap((usage) => {
          const reference = contentMediaUsageToReference(usage);
          return reference ? [reference] : [];
        }),
        drafts: contentMediaUsagesToLocalDrafts(context.mediaUsages),
        onPhaseChange: (phase) =>
          context.setMediaSavePhaseKey(contentMediaSavePhaseMessageKey(phase)),
      })
    : { status: 'complete' as const, saved: await saveContent(), resolutions: [] };

const saveEventsDetail = async (context: SaveContext, values: EventsDetailFormValues) => {
  const operationId = context.saveFeedback.beginSaving();
  context.setMediaSavePhaseKey(null);
  try {
    const correctedFields = correctedDegradedFields(context);
    if (
      correctedFields.length > 0 &&
      !globalThis.confirm(
        context.pt('messages.degradedCorrectionConfirm', {
          fields: correctedFields
            .map((field) => context.deviationFieldLabels[field] ?? field)
            .join(', '),
        })
      )
    ) {
      context.saveFeedback.reset();
      return;
    }
    const result = await persistWithMedia(
      context,
      createSaveContent(context, values, correctedFields)
    );
    const handledResult = context.mediaReferenceSync.consumeSaveResult(result);
    if (handledResult.referenceFailed) {
      context.setStatus({
        kind: 'error',
        text: context.pt('messages.mediaReferencePartialFailure'),
      });
      context.saveFeedback.markFailed(operationId);
      return;
    }
    context.setStatus(null);
    context.saveFeedback.markSaved(operationId);
    if (context.mode === 'create') {
      await context.navigate({
        to: '/admin/events/$id',
        params: { id: handledResult.saved.id },
        state: (previous) =>
          addStudioCreatedSaveFeedback(previous, 'events', handledResult.saved.id),
      });
    }
  } catch (saveError) {
    context.setStatus({
      kind: 'error',
      text: eventsErrorMessage(context.pt, saveError, 'messages.saveError'),
    });
    context.saveFeedback.markFailed(operationId);
  }
};

export const createEventsDetailSubmit = (context: SaveContext) =>
  context.methods.handleSubmit(
    async (values, event) => {
      if (!context.canSave) return;
      const form = event?.target;
      if (form instanceof HTMLFormElement && !form.reportValidity()) return;
      context.setStatus(null);
      context.methods.clearErrors();
      if (
        !validateEventsDetailSubmission({
          values,
          mediaUsages: context.mediaUsages,
          methods: context.methods,
          pt: context.pt,
          setStatus: context.setStatus,
          setActiveTab: context.setActiveTab,
          setPendingFocusId: context.setPendingFocusId,
        })
      )
        return;
      await saveEventsDetail(context, values);
    },
    (errors) => {
      const dates = errors.content?.dates;
      if (!dates) return;
      const index = (context.methods.getValues('content.dates') ?? []).findIndex((_, position) =>
        Boolean(dates[position]?.dateStart || dates[position]?.dateEnd)
      );
      if (index < 0) return;
      const field = dates[index]?.dateStart ? 'start' : 'end';
      context.setActiveTab('content');
      context.setPendingFocusId(
        index === 0 ? `event-date-${field}` : `event-date-${field}-${index}`
      );
      context.setStatus({ kind: 'error', text: context.pt('messages.validationError') });
    }
  );
