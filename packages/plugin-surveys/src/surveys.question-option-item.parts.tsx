import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import { Button, Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import { questionTypeSupportsFreeTextOptionToggle, type SurveyQuestionFormValues } from './surveys.detail-content-model.js';
import type { SurveyContentTranslate } from './surveys.question-editor.shared.js';

export function SurveyOptionTitleField({
  pt,
  questionIndex,
  optionIndex,
  title,
  onChange,
}: Readonly<{
  pt: SurveyContentTranslate;
  questionIndex: number;
  optionIndex: number;
  title: string;
  onChange: (title: string) => void;
}>) {
  const inputId = `survey-question-${questionIndex}-option-${optionIndex}-title`;
  return (
    <div className="flex-1">
      <StudioField id={inputId} label={pt('fields.optionTitle')} required className="gap-1">
        <Input
          id={inputId}
          className="flex-1"
          aria-label={pt('labels.answerSection', { index: optionIndex + 1 })}
          required
          value={title}
          onChange={(event) => onChange(event.target.value)}
        />
      </StudioField>
    </div>
  );
}

export function SurveyOptionActionButtons({
  pt,
  questionIndex,
  optionIndex,
  optionCount,
  onMove,
  onDelete,
}: Readonly<{
  pt: SurveyContentTranslate;
  questionIndex: number;
  optionIndex: number;
  optionCount: number;
  onMove: (targetIndex: number) => void;
  onDelete: (questionIndex: number, optionIndex: number) => void;
}>) {
  return (
    <>
      <Button
        type="button"
        className="shrink-0"
        size="icon"
        variant="secondary"
        disabled={optionIndex === optionCount - 1}
        aria-label={pt('actions.moveOptionDown', { index: optionIndex + 1 })}
        onClick={() => onMove(optionIndex + 1)}
      >
        <IconChevronDown aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        className="shrink-0"
        size="icon"
        variant="secondary"
        disabled={optionIndex === 0}
        aria-label={pt('actions.moveOptionUp', { index: optionIndex + 1 })}
        onClick={() => onMove(optionIndex - 1)}
      >
        <IconChevronUp aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        className="shrink-0"
        size="icon"
        variant="secondary"
        aria-label={pt('actions.deleteOption', { index: optionIndex + 1 })}
        onClick={() => onDelete(questionIndex, optionIndex)}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4" />
      </Button>
    </>
  );
}

export function SurveyOptionFreeTextToggle({
  pt,
  question,
  questionIndex,
  optionIndex,
  checked,
  onChange,
}: Readonly<{
  pt: SurveyContentTranslate;
  question: SurveyQuestionFormValues;
  questionIndex: number;
  optionIndex: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}>) {
  if (!questionTypeSupportsFreeTextOptionToggle(question.type)) {
    return null;
  }

  const inputId = `survey-question-${questionIndex}-option-${optionIndex}-free-text`;
  return (
    <StudioField id={inputId} label={pt('fields.optionEnablesFreeText')}>
      <Checkbox id={inputId} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </StudioField>
  );
}
