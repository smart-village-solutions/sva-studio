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
  getNormalizedSurveyQuestionOptions,
  normalizeSurveyQuestions,
  questionTypeSupportsOptions,
  surveyQuestionTypes,
  type SurveyQuestionFormValues,
  type SurveyQuestionType,
} from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyQuestionOptionsEditor } from './surveys.question-options-editor.js';
import {
  PendingDeleteState,
  questionTypeLabelKey,
  reorderEntries,
  type SurveyContentTranslate,
} from './surveys.question-editor.shared.js';

export function SurveyQuestionListEditor({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
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
        title={pendingDelete?.kind === 'question' ? pt('messages.deleteQuestionTitle') : pt('messages.deleteOptionTitle')}
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
