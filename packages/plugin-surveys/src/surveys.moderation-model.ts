import type { SurveyQuestionFormValues } from './surveys.detail-content-model.js';

export type SurveyFreeTextStatus = 'INTERNAL' | 'PUBLIC';

export type SurveyModerationResponse = Readonly<{
  id: string;
  text: string;
  status: SurveyFreeTextStatus;
  createdAt: string;
}>;

export type SurveyModerationQuestionGroup = Readonly<{
  questionId: string;
  questionTitle: string;
  responses: readonly SurveyModerationResponse[];
}>;

export type ModerationTranslate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export type PendingDeleteState = Readonly<{
  questionId: string;
  responseId: string;
}> | null;

export const statusLabelKey: Record<SurveyFreeTextStatus, string> = {
  INTERNAL: 'fields.freeTextStatusOptions.internal',
  PUBLIC: 'fields.freeTextStatusOptions.public',
};

export const createExcerpt = (value: string): string => {
  if (value.length <= 72) {
    return value;
  }

  return `${value.slice(0, 69)}...`;
};

export const cloneModerationGroups = (
  groups: readonly SurveyModerationQuestionGroup[]
): SurveyModerationQuestionGroup[] => groups.map((group) => ({ ...group, responses: [...group.responses] }));

export const mergeModerationGroups = (
  groups: readonly SurveyModerationQuestionGroup[],
  watchedQuestions: readonly SurveyQuestionFormValues[],
  pt: ModerationTranslate
): SurveyModerationQuestionGroup[] => {
  const byQuestionId = new Map<string, SurveyModerationQuestionGroup>();
  const byQuestionTitle = new Map<string, SurveyModerationQuestionGroup>();

  for (const group of groups) {
    byQuestionId.set(group.questionId, group);
    byQuestionTitle.set(group.questionTitle, group);
  }

  for (const [questionIndex, question] of watchedQuestions.entries()) {
    const fallbackQuestionTitle = question.title || pt('labels.questionSection', { index: questionIndex + 1 });
    const derivedQuestionId = question.id || `question-${questionIndex}`;
    const existingGroup = byQuestionId.get(derivedQuestionId) ?? byQuestionTitle.get(question.title);

    if (existingGroup) {
      if (existingGroup.questionId !== derivedQuestionId) {
        byQuestionId.delete(existingGroup.questionId);
      }

      const normalizedGroup = {
        ...existingGroup,
        questionId: derivedQuestionId,
        questionTitle: fallbackQuestionTitle,
      };
      byQuestionId.set(derivedQuestionId, normalizedGroup);
      byQuestionTitle.set(fallbackQuestionTitle, normalizedGroup);
      continue;
    }

    const nextGroup = {
      questionId: derivedQuestionId,
      questionTitle: fallbackQuestionTitle,
      responses: [],
    };
    byQuestionId.set(derivedQuestionId, nextGroup);
    byQuestionTitle.set(fallbackQuestionTitle, nextGroup);
  }

  return [...byQuestionId.values()];
};

export const toggleResponseStatus = (
  groups: readonly SurveyModerationQuestionGroup[],
  questionId: string,
  responseId: string,
  nextPublic: boolean
): SurveyModerationQuestionGroup[] =>
  groups.map((group) =>
    group.questionId === questionId
      ? {
          ...group,
          responses: group.responses.map((response) =>
            response.id === responseId
              ? { ...response, status: nextPublic ? 'PUBLIC' : 'INTERNAL' }
              : response
          ),
        }
      : group
  );

export const deleteResponse = (
  groups: readonly SurveyModerationQuestionGroup[],
  pendingDelete: Exclude<PendingDeleteState, null>
): SurveyModerationQuestionGroup[] =>
  groups.map((group) =>
    group.questionId === pendingDelete.questionId
      ? {
          ...group,
          responses: group.responses.filter((response) => response.id !== pendingDelete.responseId),
        }
      : group
  );
