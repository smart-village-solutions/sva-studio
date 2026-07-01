import { Button, Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import {
  createDefaultSurveyQuestionOption,
  questionTypeSupportsFreeTextOptionToggle,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import { reorderEntries, type SurveyContentTranslate } from './surveys.question-editor.shared.js';

type UpdateQuestion = (
  questionIndex: number,
  updater: (question: SurveyQuestionFormValues) => SurveyQuestionFormValues
) => void;

export function SurveyQuestionOptionsEditor({
  pt,
  questionIndex,
  question,
  updateQuestion,
  requestDeleteOption,
}: Readonly<{
  pt: SurveyContentTranslate;
  questionIndex: number;
  question: SurveyQuestionFormValues;
  updateQuestion: UpdateQuestion;
  requestDeleteOption: (questionIndex: number, optionIndex: number) => void;
}>) {
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
                    currentOptionIndex === optionIndex ? { ...currentOption, title: event.target.value } : currentOption
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
            options: [...currentQuestion.options, createDefaultSurveyQuestionOption(currentQuestion.options.length)],
          }))
        }
      >
        {pt('actions.addOption')}
      </Button>
    </div>
  );
}
