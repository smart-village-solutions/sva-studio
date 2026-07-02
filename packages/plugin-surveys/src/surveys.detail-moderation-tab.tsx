// fallow-ignore-file code-duplication
import React from 'react';
import { useWatch } from 'react-hook-form';

import type { SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import {
  mergeModerationGroups,
  type ModerationTranslate,
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
  setSelectedResponse,
}: Readonly<{
  mergedGroups: readonly SurveyModerationQuestionGroup[];
  pt: ModerationTranslate;
  selectedResponse: SurveyModerationResponse | null;
  setSelectedResponse: React.Dispatch<React.SetStateAction<SurveyModerationResponse | null>>;
}>) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{pt('messages.moderationReadOnly')}</p>
      {mergedGroups.map((group) => (
        <SurveyModerationGroupCard key={group.questionId} group={group} pt={pt} onOpenResponse={setSelectedResponse} />
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
  const [selectedResponse, setSelectedResponse] = React.useState<SurveyModerationResponse | null>(null);

  const mergedGroups = React.useMemo(
    () => mergeModerationGroups(groups, watchedQuestions, pt),
    [groups, pt, watchedQuestions]
  );

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
        setSelectedResponse={setSelectedResponse}
      />
    </>
  );
}
