import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Button,
  Checkbox,
  Input,
  Select,
  StudioConfirmDialog,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';

import {
  createDefaultSurveyQuestion,
  createDefaultSurveyQuestionOption,
  getNormalizedSurveyQuestionOptions,
  normalizeSurveyQuestions,
  questionTypeSupportsFreeTextOptionToggle,
  questionTypeSupportsOptions,
  surveyQuestionTypes,
  surveyResultVisibilityValues,
  type SurveyQuestionFormValues,
  type SurveyQuestionType,
} from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';

type PendingDeleteState =
  | { kind: 'question'; questionIndex: number }
  | { kind: 'option'; questionIndex: number; optionIndex: number }
  | null;

const reorderEntries = <T,>(entries: readonly T[], fromIndex: number, toIndex: number): T[] => {
  const nextEntries = [...entries];
  const [entry] = nextEntries.splice(fromIndex, 1);
  if (typeof entry === 'undefined') {
    return nextEntries;
  }
  nextEntries.splice(toIndex, 0, entry);
  return nextEntries;
};

const questionTypeLabelKey: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: 'fields.questionTypeOptions.singleChoice',
  MULTIPLE_CHOICE: 'fields.questionTypeOptions.multipleChoice',
  FREE_TEXT: 'fields.questionTypeOptions.freeText',
  SINGLE_CHOICE_WITH_TEXT: 'fields.questionTypeOptions.singleChoiceWithText',
  MULTIPLE_CHOICE_WITH_TEXT: 'fields.questionTypeOptions.multipleChoiceWithText',
};

const resultVisibilityLabelKey = {
  NONE: 'fields.resultVisibilityOptions.none',
  AFTER_SUBMISSION: 'fields.resultVisibilityOptions.afterSubmission',
  AFTER_SURVEY_END: 'fields.resultVisibilityOptions.afterSurveyEnd',
} as const;

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

type SurveyQuestionOptionsEditorProps = Readonly<{
  pt: Translate;
  questionIndex: number;
  question: SurveyQuestionFormValues;
  updateQuestion: (questionIndex: number, updater: (question: SurveyQuestionFormValues) => SurveyQuestionFormValues) => void;
  requestDeleteOption: (questionIndex: number, optionIndex: number) => void;
}>;

function SurveyQuestionOptionsEditor({
  pt,
  questionIndex,
  question,
  updateQuestion,
  requestDeleteOption,
}: SurveyQuestionOptionsEditorProps) {
  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <p className="text-sm text-muted-foreground">{pt('messages.optionSectionHint')}</p>
      {question.options.map((option, optionIndex) => (
        <div key={`${questionIndex}-${optionIndex}`} className="space-y-4 rounded-lg border border-border/60 bg-background p-4">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h5 className="text-sm font-semibold text-foreground">
              {pt('labels.optionSection', { index: optionIndex + 1 })}
            </h5>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={optionIndex === 0}
                aria-label={pt('actions.moveOptionUp', { index: optionIndex + 1 })}
                onClick={() =>
                  updateQuestion(questionIndex, (currentQuestion) => ({
                    ...currentQuestion,
                    options: reorderEntries(currentQuestion.options, optionIndex, optionIndex - 1),
                  }))
                }
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={optionIndex === question.options.length - 1}
                aria-label={pt('actions.moveOptionDown', { index: optionIndex + 1 })}
                onClick={() =>
                  updateQuestion(questionIndex, (currentQuestion) => ({
                    ...currentQuestion,
                    options: reorderEntries(currentQuestion.options, optionIndex, optionIndex + 1),
                  }))
                }
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={pt('actions.deleteOption', { index: optionIndex + 1 })}
                onClick={() => requestDeleteOption(questionIndex, optionIndex)}
              >
                {pt('actions.confirmDelete')}
              </Button>
            </div>
          </div>

          <StudioField id={`survey-question-${questionIndex}-option-${optionIndex}-title`} label={pt('fields.optionTitle')} required>
            <Input
              id={`survey-question-${questionIndex}-option-${optionIndex}-title`}
              required
              value={option.title}
              onChange={(event) =>
                updateQuestion(questionIndex, (currentQuestion) => ({
                  ...currentQuestion,
                  options: currentQuestion.options.map((currentOption, currentOptionIndex) =>
                    currentOptionIndex === optionIndex
                      ? { ...currentOption, title: event.target.value }
                      : currentOption
                  ),
                }))
              }
            />
          </StudioField>

          {questionTypeSupportsFreeTextOptionToggle(question.type) ? (
            <StudioField
              id={`survey-question-${questionIndex}-option-${optionIndex}-free-text`}
              label={pt('fields.optionEnablesFreeText')}
            >
              <Checkbox
                id={`survey-question-${questionIndex}-option-${optionIndex}-free-text`}
                checked={option.enablesFreeText}
                onChange={(event) =>
                  updateQuestion(questionIndex, (currentQuestion) => ({
                    ...currentQuestion,
                    options: currentQuestion.options.map((currentOption, currentOptionIndex) =>
                      currentOptionIndex === optionIndex
                        ? { ...currentOption, enablesFreeText: event.target.checked }
                        : currentOption
                    ),
                  }))
                }
              />
            </StudioField>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          updateQuestion(questionIndex, (currentQuestion) => ({
            ...currentQuestion,
            options: [
              ...currentQuestion.options,
              createDefaultSurveyQuestionOption(currentQuestion.options.length),
            ],
          }))
        }
      >
        {pt('actions.addOption')}
      </Button>
    </div>
  );
}

function SurveyQuestionListEditor({ pt }: Readonly<{ pt: Translate }>) {
  const { setValue } = useFormContext<SurveyDetailFormValues>();
  const questions: SurveyQuestionFormValues[] = useWatch({ name: 'content.questions' }) ?? [];
  const [pendingDelete, setPendingDelete] = React.useState<PendingDeleteState>(null);

  const updateQuestions = React.useCallback(
    (nextQuestions: readonly SurveyQuestionFormValues[]) => {
      setValue('content.questions', normalizeSurveyQuestions(nextQuestions), { shouldDirty: true });
    },
    [setValue]
  );

  const updateQuestion = React.useCallback(
    (questionIndex: number, updater: (question: SurveyQuestionFormValues) => SurveyQuestionFormValues) => {
      updateQuestions(
        questions.map((question: SurveyQuestionFormValues, currentQuestionIndex: number) =>
          currentQuestionIndex === questionIndex ? updater(question) : question
        )
      );
    },
    [questions, updateQuestions]
  );

  const handleConfirmDelete = React.useCallback(() => {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.kind === 'question') {
      updateQuestions(
        questions.filter((_: SurveyQuestionFormValues, questionIndex: number) => questionIndex !== pendingDelete.questionIndex)
      );
      setPendingDelete(null);
      return;
    }

    updateQuestion(pendingDelete.questionIndex, (question) => ({
      ...question,
      options: question.options.filter((_, optionIndex) => optionIndex !== pendingDelete.optionIndex),
    }));
    setPendingDelete(null);
  }, [pendingDelete, questions, updateQuestion, updateQuestions]);

  return (
    <div className="space-y-4">
      {questions.map((question: SurveyQuestionFormValues, questionIndex: number) => (
        <section key={`question-${questionIndex}`} className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              {pt('labels.questionSection', { index: questionIndex + 1 })}
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={questionIndex === 0}
                aria-label={pt('actions.moveQuestionUp', { index: questionIndex + 1 })}
                onClick={() => updateQuestions(reorderEntries(questions, questionIndex, questionIndex - 1))}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={questionIndex === questions.length - 1}
                aria-label={pt('actions.moveQuestionDown', { index: questionIndex + 1 })}
                onClick={() => updateQuestions(reorderEntries(questions, questionIndex, questionIndex + 1))}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={pt('actions.deleteQuestion', { index: questionIndex + 1 })}
                onClick={() => setPendingDelete({ kind: 'question', questionIndex })}
              >
                {pt('actions.confirmDelete')}
              </Button>
            </div>
          </div>

          <StudioField id={`survey-question-${questionIndex}-title`} label={pt('fields.questionTitle')} required>
            <Input
              id={`survey-question-${questionIndex}-title`}
              required
              value={question.title}
              onChange={(event) =>
                updateQuestion(questionIndex, (currentQuestion) => ({
                  ...currentQuestion,
                  title: event.target.value,
                }))
              }
            />
          </StudioField>

          <StudioField id={`survey-question-${questionIndex}-description`} label={pt('fields.questionDescription')}>
            <Textarea
              id={`survey-question-${questionIndex}-description`}
              value={question.description}
              onChange={(event) =>
                updateQuestion(questionIndex, (currentQuestion) => ({
                  ...currentQuestion,
                  description: event.target.value,
                }))
              }
            />
          </StudioField>

          <StudioFieldGroup columns={2}>
            <StudioField id={`survey-question-${questionIndex}-type`} label={pt('fields.questionType')}>
              <Select
                id={`survey-question-${questionIndex}-type`}
                value={question.type}
                onChange={(event) =>
                  updateQuestion(questionIndex, (currentQuestion) => {
                    const nextType = event.target.value as SurveyQuestionType;
                    return {
                      ...currentQuestion,
                      type: nextType,
                      options: getNormalizedSurveyQuestionOptions(nextType, currentQuestion.options),
                    };
                  })
                }
              >
                {surveyQuestionTypes.map((questionType) => (
                  <option key={questionType} value={questionType}>
                    {pt(questionTypeLabelKey[questionType])}
                  </option>
                ))}
              </Select>
            </StudioField>

            <StudioField id={`survey-question-${questionIndex}-required`} label={pt('fields.questionRequired')}>
              <Checkbox
                id={`survey-question-${questionIndex}-required`}
                checked={question.required}
                onChange={(event) =>
                  updateQuestion(questionIndex, (currentQuestion) => ({
                    ...currentQuestion,
                    required: event.target.checked,
                  }))
                }
              />
            </StudioField>
          </StudioFieldGroup>

          {questionTypeSupportsOptions(question.type) ? (
            <SurveyQuestionOptionsEditor
              pt={pt}
              question={question}
              questionIndex={questionIndex}
              updateQuestion={updateQuestion}
              requestDeleteOption={(currentQuestionIndex, optionIndex) =>
                setPendingDelete({ kind: 'option', questionIndex: currentQuestionIndex, optionIndex })
              }
            />
          ) : (
            <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
              {pt('messages.freeTextQuestionHint')}
            </p>
          )}
        </section>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => updateQuestions([...questions, createDefaultSurveyQuestion(questions.length)])}
      >
        {pt('actions.addQuestion')}
      </Button>

      <StudioConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === 'question'
            ? pt('messages.deleteQuestionTitle')
            : pt('messages.deleteOptionTitle')
        }
        description={
          pendingDelete?.kind === 'question'
            ? pt('messages.deleteQuestionDescription')
            : pt('messages.deleteOptionDescription')
        }
        confirmLabel={pt('actions.confirmDelete')}
        cancelLabel={pt('actions.cancelDelete')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export function SurveyDetailContentTab({ pt }: Readonly<{ pt: Translate }>) {
  const { register, setValue } = useFormContext<SurveyDetailFormValues>();
  const isAnonymous = useWatch({ name: 'content.isAnonymous' }) ?? false;
  const showResultsInApp = useWatch({ name: 'content.showResultsInApp' }) ?? false;
  const resultVisibility = useWatch({ name: 'content.resultVisibility' }) ?? 'NONE';

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.content.descriptions.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.content.descriptions.description')}</p>
        </div>
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <StudioField id="survey-short-description" label={pt('fields.shortDescription')}>
            <Textarea id="survey-short-description" {...register('content.shortDescription')} />
          </StudioField>
          <StudioField id="survey-description" label={pt('fields.description')}>
            <Textarea id="survey-description" {...register('content.description')} />
          </StudioField>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.content.participation.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.content.participation.description')}</p>
        </div>
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <StudioField id="survey-is-anonymous" label={pt('fields.isAnonymous')}>
            <Checkbox
              id="survey-is-anonymous"
              checked={isAnonymous}
              onChange={(event) => setValue('content.isAnonymous', event.target.checked, { shouldDirty: true })}
            />
          </StudioField>
          <StudioField id="survey-show-results-in-app" label={pt('fields.showResultsInApp')}>
            <Checkbox
              id="survey-show-results-in-app"
              checked={showResultsInApp}
              onChange={(event) => setValue('content.showResultsInApp', event.target.checked, { shouldDirty: true })}
            />
          </StudioField>
          <StudioField id="survey-result-visibility" label={pt('fields.resultVisibility')}>
            <Select
              id="survey-result-visibility"
              value={resultVisibility}
              onChange={(event) =>
                setValue(
                  'content.resultVisibility',
                  event.target.value as SurveyDetailFormValues['content']['resultVisibility'],
                  { shouldDirty: true }
                )
              }
            >
              {surveyResultVisibilityValues.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {pt(resultVisibilityLabelKey[visibility])}
                </option>
              ))}
            </Select>
          </StudioField>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.content.notices.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.content.notices.description')}</p>
        </div>
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <StudioField id="survey-privacy-notice" label={pt('fields.privacyNotice')}>
            <Textarea id="survey-privacy-notice" {...register('content.privacyNotice')} />
          </StudioField>
          <StudioField id="survey-transparency-notice" label={pt('fields.transparencyNotice')}>
            <Textarea id="survey-transparency-notice" {...register('content.transparencyNotice')} />
          </StudioField>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.content.questions.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.content.questions.description')}</p>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <SurveyQuestionListEditor pt={pt} />
        </div>
      </section>
    </div>
  );
}
