import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  useStudioEditorLeaveGuard,
  useStudioSaveFeedback,
  MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { createSurvey, updateSurvey } from './surveys.api.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import {
  getSurveyEditorErrorMessage,
  mapSurveyItemToFormValues,
  toSurveyMutationInput,
  type SurveyEditorMode,
} from './surveys.editor.shared.js';
import type { SurveyContentItem, SurveyLocalizedText } from './surveys.types.js';
import type { SurveyEditorStatus } from './surveys.editor-logic.js';
type SurveyEditorTranslation = (key: string) => string;

type SurveySaveInput = {
  readonly methods: UseFormReturn<SurveyDetailFormValues>;
  readonly leaveGuard: ReturnType<typeof useStudioEditorLeaveGuard>;
  readonly createdContentIdRef: Readonly<{ current: string | null }>;
  readonly rememberCreated: (id: string) => void;
  readonly mode: SurveyEditorMode;
  readonly contentId?: string;
  readonly loadedItem: SurveyContentItem | null;
  readonly readCurrentItem: () => Promise<SurveyContentItem | undefined>;
  readonly actingPrincipalType: MainserverPrincipalType;
  readonly pt: SurveyEditorTranslation;
  readonly navigateToCreatedDetail: (contentId: string) => Promise<void>;
  readonly setLoadedItem: (item: SurveyContentItem) => Promise<void>;
  readonly setStatus: React.Dispatch<React.SetStateAction<SurveyEditorStatus>>;
  readonly saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
};

export const createSurveyEditorSubmit = (input: SurveySaveInput) =>
  input.methods.handleSubmit(
    async (values) => {
      if (input.mode === 'create' && input.createdContentIdRef.current !== null) return;
      const leaveRevision = input.leaveGuard.captureRevision();
      let operationId: number | null = null;
      try {
        if (!canSaveSurvey(input)) return;

        operationId = input.saveFeedback.beginSaving();
        if (input.mode === 'edit' && input.contentId && input.loadedItem) {
          const current = await input.readCurrentItem();
          if (!current) {
            input.saveFeedback.markFailed(operationId);
            input.setStatus({ kind: 'error', text: input.pt('messages.loadError') });
            return;
          }
          if (editableSurveySnapshot(current) !== editableSurveySnapshot(input.loadedItem)) {
            input.saveFeedback.markFailed(operationId);
            input.setStatus({ kind: 'error', text: input.pt('messages.editConflict') });
            return;
          }
        }
        const savedItem = await saveSurveyMutation(input, values);

        if (input.mode === 'create') input.rememberCreated(savedItem.id);
        await input.setLoadedItem(savedItem);
        if (input.mode !== 'create') input.methods.reset(mapSurveyItemToFormValues(savedItem));
        else if (input.leaveGuard.acknowledgeSaved(leaveRevision))
          input.methods.reset(input.methods.getValues());
        input.setStatus(null);
        input.saveFeedback.markSaved(operationId);

        if (input.mode === 'create') {
          await input.navigateToCreatedDetail(savedItem.id);
        }
      } catch (error) {
        if (input.mode === 'create' && input.createdContentIdRef.current !== null) {
          input.setStatus({ kind: 'success', text: input.pt('messages.createdNavigationError') });
          return;
        }
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

const orderedText = (text: SurveyLocalizedText | undefined) =>
  Object.entries(text ?? {}).sort(([left], [right]) => left.localeCompare(right));

function editableSurveySnapshot(survey: SurveyContentItem) {
  return JSON.stringify({
    title: orderedText(survey.title),
    shortDescription: orderedText(survey.shortDescription),
    description: orderedText(survey.description),
    status: survey.status,
    startAt: survey.startAt,
    endAt: survey.endAt,
    resultVisibility: survey.resultVisibility,
    targetAreaIds: [...survey.targetAreaIds].sort(),
    showResultsInApp: survey.showResultsInApp,
    isAnonymous: survey.isAnonymous,
    privacyNotice: orderedText(survey.privacyNotice),
    transparencyNotice: orderedText(survey.transparencyNotice),
    questions: survey.questions.map((question) => ({
      id: question.id,
      title: orderedText(question.title),
      description: orderedText(question.description),
      type: question.type,
      required: question.required,
      position: question.position,
      options: question.options.map((option) => ({
        id: option.id,
        title: orderedText(option.title),
        position: option.position,
        enablesFreeText: option.enablesFreeText,
      })),
    })),
  });
}

function canSaveSurvey(input: SurveySaveInput): boolean {
  if (input.mode === 'edit' && !input.contentId) {
    input.setStatus({ kind: 'error', text: input.pt('messages.missingContentId') });
    return false;
  }
  if (input.mode === 'edit' && !input.loadedItem) {
    input.setStatus({ kind: 'error', text: input.pt('messages.loadError') });
    return false;
  }

  return true;
}

async function saveSurveyMutation(input: SurveySaveInput, values: SurveyDetailFormValues) {
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
  return input.mode === 'edit' && input.loadedItem?.results && mutationResult.results === undefined
    ? { ...mutationResult, results: input.loadedItem.results }
    : mutationResult;
}
