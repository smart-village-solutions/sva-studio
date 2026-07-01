import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@sva/studio-ui-react';

import { SurveyDetailCard } from './surveys.detail-card.js';
import {
  createExcerpt,
  statusLabelKey,
  type ModerationTranslate,
  type SurveyModerationQuestionGroup,
  type SurveyModerationResponse,
} from './surveys.moderation-model.js';

export function SurveyModerationPlaceholder({
  description,
  message,
  pt,
}: Readonly<{
  description: string;
  message: string;
  pt: ModerationTranslate;
}>) {
  return (
    <SurveyDetailCard title={pt('cards.moderation.title')} description={description}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </SurveyDetailCard>
  );
}

export function SurveyModerationGroupCard({
  group,
  pt,
  onDelete,
  onOpenResponse,
  onToggleVisibility,
}: Readonly<{
  group: SurveyModerationQuestionGroup;
  pt: ModerationTranslate;
  onDelete: (questionId: string, responseId: string) => void;
  onOpenResponse: (response: SurveyModerationResponse) => void;
  onToggleVisibility: (questionId: string, responseId: string, nextPublic: boolean) => void;
}>) {
  return (
    <SurveyDetailCard title={group.questionTitle} description={pt('cards.moderation.description')}>
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
                      onClick={() => onOpenResponse(response)}
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
                        onChange={(event) => onToggleVisibility(group.questionId, response.id, event.target.checked)}
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
                      onClick={() => onDelete(group.questionId, response.id)}
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
    </SurveyDetailCard>
  );
}

export function SurveyModerationResponseDialog({
  pt,
  selectedResponse,
  onClose,
}: Readonly<{
  pt: ModerationTranslate;
  selectedResponse: SurveyModerationResponse | null;
  onClose: () => void;
}>) {
  return (
    <Dialog open={selectedResponse !== null} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
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
            <Button type="button" variant="outline" onClick={onClose}>
              {pt('actions.closeOverlay')}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
