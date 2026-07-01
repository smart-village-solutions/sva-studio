// fallow-ignore-file code-duplication
import React from 'react';
import { useWatch } from 'react-hook-form';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StudioConfirmDialog,
} from '@sva/studio-ui-react';

import type { SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';

type SurveyFreeTextStatus = 'INTERNAL' | 'PUBLIC';

export type SurveyModerationResponse = Readonly<{
  id: string;
  text: string;
  status: SurveyFreeTextStatus;
  createdAt: string;
}>;

export type SurveyModerationQuestionGroup = Readonly<{
  questionId: string;
  questionTitle: string;
  responses: readonly SurveyModerationResponse[];
}>;

type PendingDeleteState = Readonly<{
  questionId: string;
  responseId: string;
}> | null;

type ModerationTranslate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const createExcerpt = (value: string): string => {
  if (value.length <= 72) {
    return value;
  }

  return `${value.slice(0, 69)}...`;
};

const statusLabelKey: Record<SurveyFreeTextStatus, string> = {
  INTERNAL: 'fields.freeTextStatusOptions.internal',
  PUBLIC: 'fields.freeTextStatusOptions.public',
};

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
    groups.map((group) => ({ ...group, responses: [...group.responses] }))
  );
  const [selectedResponse, setSelectedResponse] = React.useState<SurveyModerationResponse | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDeleteState>(null);

  React.useEffect(() => {
    setQuestionGroups(groups.map((group) => ({ ...group, responses: [...group.responses] })));
  }, [groups]);

  const mergedGroups = React.useMemo(() => {
    const byQuestionId = new Map<string, SurveyModerationQuestionGroup>();

    for (const group of questionGroups) {
      byQuestionId.set(group.questionId, group);
    }

    for (const [questionIndex, question] of watchedQuestions.entries()) {
      if (!byQuestionId.has(`question-${questionIndex}`) && ![...byQuestionId.values()].some((group) => group.questionTitle === question.title)) {
        byQuestionId.set(`question-${questionIndex}`, {
          questionId: `question-${questionIndex}`,
          questionTitle: question.title || pt('labels.questionSection', { index: questionIndex + 1 }),
          responses: [],
        });
      }
    }

    return [...byQuestionId.values()];
  }, [pt, questionGroups, watchedQuestions]);

  const handleDeleteConfirm = React.useCallback(() => {
    if (!pendingDelete) {
      return;
    }

    setQuestionGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.questionId === pendingDelete.questionId
          ? {
              ...group,
              responses: group.responses.filter((response) => response.id !== pendingDelete.responseId),
            }
          : group
      )
    );
    setPendingDelete(null);
  }, [pendingDelete]);

  if (mode === 'create') {
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{pt('cards.moderation.title')}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.moderation.description')}</p>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">{pt('messages.createPendingHint')}</p>
          </div>
        </section>
      </div>
    );
  }

  if (mergedGroups.length === 0) {
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{pt('cards.moderation.title')}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.moderation.description')}</p>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">{pt('messages.moderationEmpty')}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {mergedGroups.map((group) => (
        <section key={group.questionId} className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{group.questionTitle}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.moderation.description')}</p>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            {group.responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{pt('messages.moderationEmptyQuestion')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm" aria-label={group.questionTitle}>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 font-medium text-foreground">{pt('fields.freeTextExcerpt')}</th>
                      <th className="px-3 py-2 font-medium text-foreground">{pt('fields.freeTextCreatedAt')}</th>
                      <th className="px-3 py-2 font-medium text-foreground">{pt('fields.freeTextStatus')}</th>
                      <th className="px-3 py-2 font-medium text-foreground">{pt('actions.delete')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.responses.map((response, responseIndex) => (
                      <tr key={response.id} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-3 align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto whitespace-normal p-0 text-left"
                            aria-label={pt('fields.freeTextOpenOverlay')}
                            onClick={() => setSelectedResponse(response)}
                          >
                            {createExcerpt(response.text)}
                          </Button>
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">{response.createdAt}</td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              aria-label={pt('labels.freeTextVisibility', { index: responseIndex + 1 })}
                              checked={response.status === 'PUBLIC'}
                              onChange={(event) =>
                                setQuestionGroups((currentGroups) =>
                                  currentGroups.map((currentGroup) =>
                                    currentGroup.questionId === group.questionId
                                      ? {
                                          ...currentGroup,
                                          responses: currentGroup.responses.map((currentResponse) =>
                                            currentResponse.id === response.id
                                              ? {
                                                  ...currentResponse,
                                                  status: event.target.checked ? 'PUBLIC' : 'INTERNAL',
                                                }
                                              : currentResponse
                                          ),
                                        }
                                      : currentGroup
                                  )
                                )
                              }
                            />
                            <span className="text-muted-foreground">{pt(statusLabelKey[response.status])}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={pt('actions.deleteFreeText', { index: responseIndex + 1 })}
                            onClick={() =>
                              setPendingDelete({
                                questionId: group.questionId,
                                responseId: response.id,
                              })
                            }
                          >
                            {pt('actions.confirmDelete')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}

      <Dialog open={selectedResponse !== null} onOpenChange={(nextOpen) => (!nextOpen ? setSelectedResponse(null) : undefined)}>
        {selectedResponse ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{pt('fields.freeTextOverlayText')}</DialogTitle>
              <DialogDescription>{selectedResponse.text}</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="font-medium text-foreground">{pt('fields.freeTextOverlayStatus')}</dt>
                <dd className="text-muted-foreground">{pt(statusLabelKey[selectedResponse.status])}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">{pt('fields.freeTextOverlayCreatedAt')}</dt>
                <dd className="text-muted-foreground">{selectedResponse.createdAt}</dd>
              </div>
            </dl>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedResponse(null)}>
                {pt('actions.closeOverlay')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <StudioConfirmDialog
        open={pendingDelete !== null}
        title={pt('messages.deleteFreeTextTitle')}
        description={pt('messages.deleteFreeTextDescription')}
        confirmLabel={pt('actions.confirmDelete')}
        cancelLabel={pt('actions.cancelDelete')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
