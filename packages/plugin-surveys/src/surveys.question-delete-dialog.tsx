import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';

import type { SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import {
  type PendingDeleteState,
  type SurveyContentTranslate,
} from './surveys.question-editor.shared.js';

export function SurveyQuestionDeleteDialog({
  pt,
  questions,
  pendingDelete,
  onConfirm,
  onCancel,
}: Readonly<{
  pt: SurveyContentTranslate;
  questions: readonly SurveyQuestionFormValues[];
  pendingDelete: PendingDeleteState;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const question = pendingDelete ? questions[pendingDelete.questionIndex] : undefined;
  const questionTarget =
    question?.title.trim() ||
    pt('labels.questionSection', { index: (pendingDelete?.questionIndex ?? 0) + 1 });
  const option =
    pendingDelete?.kind === 'option' ? question?.options[pendingDelete.optionIndex] : undefined;
  const optionTarget =
    option?.title.trim() ||
    pt('labels.answerSection', {
      index: pendingDelete?.kind === 'option' ? pendingDelete.optionIndex + 1 : 1,
    });

  return (
    <StudioDestructiveActionDialog
      open={pendingDelete !== null}
      title={
        pendingDelete?.kind === 'question'
          ? pt('messages.deleteQuestionTitle', { target: questionTarget })
          : pt('messages.deleteOptionTitle', { target: optionTarget })
      }
      description={
        pendingDelete?.kind === 'question'
          ? pt('messages.deleteQuestionDescription', { target: questionTarget })
          : pt('messages.deleteOptionDescription', {
              target: optionTarget,
              question: questionTarget,
            })
      }
      confirmLabel={pt('actions.confirmDelete')}
      pendingLabel={pt('actions.confirmDelete')}
      cancelLabel={pt('actions.cancelDelete')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
