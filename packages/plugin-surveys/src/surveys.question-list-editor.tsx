import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@sva/studio-ui-react';

import {
  createDefaultSurveyQuestion,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import {
  PendingDeleteState,
  type SurveyContentTranslate,
} from './surveys.question-editor.shared.js';
import { SurveyQuestionDeleteDialog } from './surveys.question-delete-dialog.js';
import { SurveyQuestionSection } from './surveys.question-section.js';
import { updateSurveyQuestionList } from './surveys.question-list.shared.js';

const getSurveyQuestionRenderKey = (question: SurveyQuestionFormValues, questionIndex: number): string =>
  question.id ?? `question-draft-${question.position}-${questionIndex}`;

export function SurveyQuestionListEditor({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { setValue } = useFormContext<SurveyDetailFormValues>();
  const questions: SurveyQuestionFormValues[] = useWatch({ name: 'content.questions' }) ?? [];
  const [pendingDelete, setPendingDelete] = React.useState<PendingDeleteState>(null);

  const updateQuestions = React.useCallback(
    (nextQuestions: readonly SurveyQuestionFormValues[]) => {
      updateSurveyQuestionList(setValue, nextQuestions);
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
        <SurveyQuestionSection
          key={getSurveyQuestionRenderKey(question, questionIndex)}
          pt={pt}
          question={question}
          questionIndex={questionIndex}
          questionCount={questions.length}
          questions={questions}
          updateQuestion={updateQuestion}
          updateQuestions={updateQuestions}
          requestDeleteQuestion={(currentQuestionIndex) =>
            setPendingDelete({ kind: 'question', questionIndex: currentQuestionIndex })
          }
          requestDeleteOption={(currentQuestionIndex, optionIndex) =>
            setPendingDelete({ kind: 'option', questionIndex: currentQuestionIndex, optionIndex })
          }
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => updateQuestions([...questions, createDefaultSurveyQuestion(questions.length)])}
      >
        {pt('actions.addQuestion')}
      </Button>
      <SurveyQuestionDeleteDialog
        pt={pt}
        pendingDelete={pendingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
