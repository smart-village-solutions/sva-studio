import { Button, Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import {
  questionTypeSupportsFreeTextOptionToggle,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import { reorderEntries, type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import type { UpdateSurveyQuestion } from './surveys.question-list.shared.js';

export function SurveyQuestionOptionItem({
  pt,
  questionIndex,
  optionIndex,
  optionCount,
  question,
  updateQuestion,
  requestDeleteOption,
}: Readonly<{
  pt: SurveyContentTranslate;
  questionIndex: number;
  optionIndex: number;
  optionCount: number;
  question: SurveyQuestionFormValues;
  updateQuestion: UpdateSurveyQuestion;
  requestDeleteOption: (questionIndex: number, optionIndex: number) => void;
}>) {
  const updateOptionTitle = (title: string) => {
    updateQuestion(questionIndex, (currentQuestion) => ({
      ...currentQuestion,
      options: currentQuestion.options.map((currentOption, currentOptionIndex) =>
        currentOptionIndex === optionIndex ? { ...currentOption, title } : currentOption
      ),
    }));
  };

  const updateOptionFreeText = (enablesFreeText: boolean) => {
    updateQuestion(questionIndex, (currentQuestion) => ({
      ...currentQuestion,
      options: currentQuestion.options.map((currentOption, currentOptionIndex) =>
        currentOptionIndex === optionIndex ? { ...currentOption, enablesFreeText } : currentOption
      ),
    }));
  };

  const moveOption = (targetIndex: number) => {
    updateQuestion(questionIndex, (currentQuestion) => ({
      ...currentQuestion,
      options: reorderEntries(currentQuestion.options, optionIndex, targetIndex),
    }));
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h5 className="text-sm font-semibold text-foreground">{pt('labels.optionSection', { index: optionIndex + 1 })}</h5>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={optionIndex === 0}
            aria-label={pt('actions.moveOptionUp', { index: optionIndex + 1 })}
            onClick={() => moveOption(optionIndex - 1)}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={optionIndex === optionCount - 1}
            aria-label={pt('actions.moveOptionDown', { index: optionIndex + 1 })}
            onClick={() => moveOption(optionIndex + 1)}
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
          value={question.options[optionIndex]?.title ?? ''}
          onChange={(event) => updateOptionTitle(event.target.value)}
        />
      </StudioField>

      {questionTypeSupportsFreeTextOptionToggle(question.type) ? (
        <StudioField
          id={`survey-question-${questionIndex}-option-${optionIndex}-free-text`}
          label={pt('fields.optionEnablesFreeText')}
        >
          <Checkbox
            id={`survey-question-${questionIndex}-option-${optionIndex}-free-text`}
            checked={question.options[optionIndex]?.enablesFreeText ?? false}
            onChange={(event) => updateOptionFreeText(event.target.checked)}
          />
        </StudioField>
      ) : null}
    </div>
  );
}
