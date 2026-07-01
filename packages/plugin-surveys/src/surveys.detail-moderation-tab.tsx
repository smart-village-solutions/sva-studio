// fallow-ignore-file code-duplication
import React from 'react';
import { useWatch } from 'react-hook-form';
import { StudioConfirmDialog } from '@sva/studio-ui-react';

import type { SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import {
  cloneModerationGroups,
  deleteResponse,
  mergeModerationGroups,
  toggleResponseStatus,
  type ModerationTranslate,
  type PendingDeleteState,
  type SurveyModerationQuestionGroup,
  type SurveyModerationResponse,
} from './surveys.moderation-model.js';
import {
  SurveyModerationGroupCard,
  SurveyModerationPlaceholder,
  SurveyModerationResponseDialog,
} from './surveys.moderation-sections.js';

export type { SurveyModerationQuestionGroup, SurveyModerationResponse } from './surveys.moderation-model.js';

function SurveyModerationState({
  mergedGroups,
  pt,
  selectedResponse,
  setPendingDelete,
  setQuestionGroups,
  setSelectedResponse,
}: Readonly<{
  mergedGroups: readonly SurveyModerationQuestionGroup[];
  pt: ModerationTranslate;
  selectedResponse: SurveyModerationResponse | null;
  setPendingDelete: React.Dispatch<React.SetStateAction<PendingDeleteState>>;
  setQuestionGroups: React.Dispatch<React.SetStateAction<SurveyModerationQuestionGroup[]>>;
  setSelectedResponse: React.Dispatch<React.SetStateAction<SurveyModerationResponse | null>>;
}>) {
  return (
    <div className="space-y-5">
      {mergedGroups.map((group) => (
        <SurveyModerationGroupCard
          key={group.questionId}
          group={group}
          pt={pt}
          onDelete={(questionId, responseId) => setPendingDelete({ questionId, responseId })}
          onOpenResponse={setSelectedResponse}
          onToggleVisibility={(questionId, responseId, nextPublic) =>
            setQuestionGroups((currentGroups) => toggleResponseStatus(currentGroups, questionId, responseId, nextPublic))
          }
        />
      ))}

      <SurveyModerationResponseDialog pt={pt} selectedResponse={selectedResponse} onClose={() => setSelectedResponse(null)} />
    </div>
  );
}

export function SurveyDetailModerationTab({
  mode,
  groups,
  pt,
}: Readonly<{
  mode: 'create' | 'edit';
  groups: readonly SurveyModerationQuestionGroup[];
  pt: ModerationTranslate;
}>) {
  const watchedQuestions: SurveyQuestionFormValues[] = useWatch({ name: 'content.questions' }) ?? [];
  const [questionGroups, setQuestionGroups] = React.useState<SurveyModerationQuestionGroup[]>(() =>
    cloneModerationGroups(groups)
  );
  const [selectedResponse, setSelectedResponse] = React.useState<SurveyModerationResponse | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDeleteState>(null);

  React.useEffect(() => {
    setQuestionGroups(cloneModerationGroups(groups));
  }, [groups]);

  const mergedGroups = React.useMemo(
    () => mergeModerationGroups(questionGroups, watchedQuestions, pt),
    [pt, questionGroups, watchedQuestions]
  );

  const handleDeleteConfirm = React.useCallback(() => {
    if (!pendingDelete) {
      return;
    }

    setQuestionGroups((currentGroups) => deleteResponse(currentGroups, pendingDelete));
    setPendingDelete(null);
  }, [pendingDelete]);

  if (mode === 'create') {
    return (
      <SurveyModerationPlaceholder
        description={pt('cards.moderation.description')}
        message={pt('messages.createPendingHint')}
        pt={pt}
      />
    );
  }

  if (mergedGroups.length === 0) {
    return (
      <SurveyModerationPlaceholder
        description={pt('cards.moderation.description')}
        message={pt('messages.moderationEmpty')}
        pt={pt}
      />
    );
  }

  return (
    <>
      <SurveyModerationState
        mergedGroups={mergedGroups}
        pt={pt}
        selectedResponse={selectedResponse}
        setPendingDelete={setPendingDelete}
        setQuestionGroups={setQuestionGroups}
        setSelectedResponse={setSelectedResponse}
      />
      <StudioConfirmDialog
        open={pendingDelete !== null}
        title={pt('messages.deleteFreeTextTitle')}
        description={pt('messages.deleteFreeTextDescription')}
        confirmLabel={pt('actions.confirmDelete')}
        cancelLabel={pt('actions.cancelDelete')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
