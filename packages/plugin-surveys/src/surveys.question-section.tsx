import {
  questionTypeSupportsOptions,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import { SurveyQuestionFormFields } from './surveys.question-form-fields.js';
import { SurveyQuestionHeader } from './surveys.question-header.js';
import { SurveyQuestionOptionsEditor } from './surveys.question-options-editor.js';
import { type SurveyContentTranslate } from './surveys.question-editor.shared.js';
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
  return (
    <section className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
      <SurveyQuestionHeader
        pt={pt}
        questionIndex={questionIndex}
        questionCount={questionCount}
        questions={questions}
        updateQuestions={updateQuestions}
        requestDeleteQuestion={requestDeleteQuestion}
      />
      <SurveyQuestionFormFields
        pt={pt}
        question={question}
        questionIndex={questionIndex}
        updateQuestion={updateQuestion}
      />

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
