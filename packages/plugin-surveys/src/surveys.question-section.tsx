import { Button, Checkbox, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import {
  getNormalizedSurveyQuestionOptions,
  questionTypeSupportsOptions,
  surveyQuestionTypes,
  type SurveyQuestionFormValues,
  type SurveyQuestionType,
} from './surveys.detail-content-model.js';
import { SurveyQuestionOptionsEditor } from './surveys.question-options-editor.js';
import {
  questionTypeLabelKey,
  reorderEntries,
  type SurveyContentTranslate,
} from './surveys.question-editor.shared.js';
import type { UpdateSurveyQuestion } from './surveys.question-list.shared.js';

export function SurveyQuestionSection({
  pt,
  question,
  questionIndex,
  questionCount,
  questions,
  updateQuestion,
  updateQuestions,
  requestDeleteQuestion,
  requestDeleteOption,
}: Readonly<{
  pt: SurveyContentTranslate;
  question: SurveyQuestionFormValues;
  questionIndex: number;
  questionCount: number;
  questions: readonly SurveyQuestionFormValues[];
  updateQuestion: UpdateSurveyQuestion;
  updateQuestions: (nextQuestions: readonly SurveyQuestionFormValues[]) => void;
  requestDeleteQuestion: (questionIndex: number) => void;
  requestDeleteOption: (questionIndex: number, optionIndex: number) => void;
}>) {
  const moveQuestion = (targetIndex: number) => updateQuestions(reorderEntries(questions, questionIndex, targetIndex));

  return (
    <section className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-foreground">{pt('labels.questionSection', { index: questionIndex + 1 })}</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={questionIndex === 0}
            aria-label={pt('actions.moveQuestionUp', { index: questionIndex + 1 })}
            onClick={() => moveQuestion(questionIndex - 1)}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={questionIndex === questionCount - 1}
            aria-label={pt('actions.moveQuestionDown', { index: questionIndex + 1 })}
            onClick={() => moveQuestion(questionIndex + 1)}
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={pt('actions.deleteQuestion', { index: questionIndex + 1 })}
            onClick={() => requestDeleteQuestion(questionIndex)}
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
            updateQuestion(questionIndex, (currentQuestion) => ({ ...currentQuestion, title: event.target.value }))
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
          requestDeleteOption={requestDeleteOption}
        />
      ) : (
        <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">{pt('messages.freeTextQuestionHint')}</p>
      )}
    </section>
  );
}
