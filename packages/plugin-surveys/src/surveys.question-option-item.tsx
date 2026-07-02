import { Button, Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import {
  questionTypeSupportsFreeTextOptionToggle,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import { reorderEntries, type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import type { UpdateSurveyQuestion } from './surveys.question-list.shared.js';

function DownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M4 10l4-4 4 4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-[1.5]">
      <path d="M3.5 4.5h9" />
      <path d="M6 4.5V3.25h4v1.25" />
      <path d="M5.25 6.25v5.5" />
      <path d="M8 6.25v5.5" />
      <path d="M10.75 6.25v5.5" />
      <path d="M4.5 4.5l.5 8h6l.5-8" />
    </svg>
  );
}

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
    <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <StudioField
            id={`survey-question-${questionIndex}-option-${optionIndex}-title`}
            label={pt('fields.optionTitle')}
            required
            className="gap-1"
          >
            <Input
              id={`survey-question-${questionIndex}-option-${optionIndex}-title`}
              className="flex-1"
              aria-label={pt('labels.answerSection', { index: optionIndex + 1 })}
              required
              value={question.options[optionIndex]?.title ?? ''}
              onChange={(event) => updateOptionTitle(event.target.value)}
            />
          </StudioField>
        </div>
        <Button
          type="button"
          className="shrink-0"
          size="icon"
          variant="outline"
          disabled={optionIndex === optionCount - 1}
          aria-label={pt('actions.moveOptionDown', { index: optionIndex + 1 })}
          onClick={() => moveOption(optionIndex + 1)}
        >
          <DownIcon />
        </Button>
        <Button
          type="button"
          className="shrink-0"
          size="icon"
          variant="outline"
          disabled={optionIndex === 0}
          aria-label={pt('actions.moveOptionUp', { index: optionIndex + 1 })}
          onClick={() => moveOption(optionIndex - 1)}
        >
          <UpIcon />
        </Button>
        <Button
          type="button"
          className="shrink-0"
          size="icon"
          variant="outline"
          aria-label={pt('actions.deleteOption', { index: optionIndex + 1 })}
          onClick={() => requestDeleteOption(questionIndex, optionIndex)}
        >
          <DeleteIcon />
        </Button>
      </div>

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
