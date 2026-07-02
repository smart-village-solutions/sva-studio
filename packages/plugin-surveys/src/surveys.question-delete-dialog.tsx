import { StudioConfirmDialog } from '@sva/studio-ui-react';

import { type PendingDeleteState, type SurveyContentTranslate } from './surveys.question-editor.shared.js';

export function SurveyQuestionDeleteDialog({
  pt,
  pendingDelete,
  onConfirm,
  onCancel,
}: Readonly<{
  pt: SurveyContentTranslate;
  pendingDelete: PendingDeleteState;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return (
    <StudioConfirmDialog
      open={pendingDelete !== null}
      title={pendingDelete?.kind === 'question' ? pt('messages.deleteQuestionTitle') : pt('messages.deleteOptionTitle')}
      description={
        pendingDelete?.kind === 'question'
          ? pt('messages.deleteQuestionDescription')
          : pt('messages.deleteOptionDescription')
      }
      confirmLabel={pt('actions.confirmDelete')}
      cancelLabel={pt('actions.cancelDelete')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
