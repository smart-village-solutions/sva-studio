import { type SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import { reorderEntries, type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import {
  SurveyOptionActionButtons,
  SurveyOptionFreeTextToggle,
  SurveyOptionTitleField,
} from './surveys.question-option-item.parts.js';
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
    <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-end gap-2">
        <SurveyOptionTitleField
          pt={pt}
          questionIndex={questionIndex}
          optionIndex={optionIndex}
          title={question.options[optionIndex]?.title ?? ''}
          onChange={updateOptionTitle}
        />
        <SurveyOptionActionButtons
          pt={pt}
          questionIndex={questionIndex}
          optionIndex={optionIndex}
          optionCount={optionCount}
          onMove={moveOption}
          onDelete={requestDeleteOption}
        />
      </div>
      <SurveyOptionFreeTextToggle
        pt={pt}
        question={question}
        questionIndex={questionIndex}
        optionIndex={optionIndex}
        checked={question.options[optionIndex]?.enablesFreeText ?? false}
        onChange={updateOptionFreeText}
      />
    </div>
  );
}
