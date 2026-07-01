import { Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import {
  questionTypeSupportsFreeTextOptionToggle,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import { reorderEntries, type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import type { UpdateSurveyQuestion } from './surveys.question-list.shared.js';
import { SurveyQuestionOptionActions } from './surveys.question-option-actions.js';

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
      <SurveyQuestionOptionActions
        pt={pt}
        optionIndex={optionIndex}
        optionCount={optionCount}
        onMoveUp={() => moveOption(optionIndex - 1)}
        onMoveDown={() => moveOption(optionIndex + 1)}
        onDelete={() => requestDeleteOption(questionIndex, optionIndex)}
      />

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
