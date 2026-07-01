import { Button } from '@sva/studio-ui-react';

import {
  createDefaultSurveyQuestionOption,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import { type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import { SurveyQuestionOptionItem } from './surveys.question-option-item.js';
import { type UpdateSurveyQuestion } from './surveys.question-list.shared.js';

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
  updateQuestion: UpdateSurveyQuestion;
  requestDeleteOption: (questionIndex: number, optionIndex: number) => void;
}>) {
  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <p className="text-sm text-muted-foreground">{pt('messages.optionSectionHint')}</p>
      {question.options.map((option, optionIndex) => (
        <SurveyQuestionOptionItem
          key={`${questionIndex}-${optionIndex}`}
          pt={pt}
          questionIndex={questionIndex}
          optionIndex={optionIndex}
          optionCount={question.options.length}
          question={question}
          updateQuestion={updateQuestion}
          requestDeleteOption={requestDeleteOption}
        />
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
