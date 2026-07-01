import { Button } from '@sva/studio-ui-react';

import type { SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import { reorderEntries, type SurveyContentTranslate } from './surveys.question-editor.shared.js';

export function SurveyQuestionHeader({
  pt,
  questionIndex,
  questionCount,
  questions,
  updateQuestions,
  requestDeleteQuestion,
}: Readonly<{
  pt: SurveyContentTranslate;
  questionIndex: number;
  questionCount: number;
  questions: readonly SurveyQuestionFormValues[];
  updateQuestions: (nextQuestions: readonly SurveyQuestionFormValues[]) => void;
  requestDeleteQuestion: (questionIndex: number) => void;
}>) {
  const moveQuestion = (targetIndex: number) => updateQuestions(reorderEntries(questions, questionIndex, targetIndex));

  return (
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
  );
}
