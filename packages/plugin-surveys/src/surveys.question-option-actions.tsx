import { Button } from '@sva/studio-ui-react';

import { type SurveyContentTranslate } from './surveys.question-editor.shared.js';

export function SurveyQuestionOptionActions({
  pt,
  optionIndex,
  optionCount,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Readonly<{
  pt: SurveyContentTranslate;
  optionIndex: number;
  optionCount: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}>) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <h5 className="text-sm font-semibold text-foreground">{pt('labels.optionSection', { index: optionIndex + 1 })}</h5>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={optionIndex === 0}
          aria-label={pt('actions.moveOptionUp', { index: optionIndex + 1 })}
          onClick={onMoveUp}
        >
          ↑
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={optionIndex === optionCount - 1}
          aria-label={pt('actions.moveOptionDown', { index: optionIndex + 1 })}
          onClick={onMoveDown}
        >
          ↓
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={pt('actions.deleteOption', { index: optionIndex + 1 })}
          onClick={onDelete}
        >
          {pt('actions.confirmDelete')}
        </Button>
      </div>
    </div>
  );
}
