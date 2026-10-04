import * as React from 'react';

import { Textarea } from './textarea.js';
import type { RichTextHtmlEditorToolbarLabels } from './rich-text-editor-types.js';

type RichTextEditorHtmlProps = Readonly<{
  id: string;
  labelId?: string;
  describedBy?: string;
  ariaInvalid: boolean;
  disabled: boolean;
  value: string;
  htmlDraft: string;
  setHtmlDraft: (value: string) => void;
  lastHtmlDraftEmission: React.RefObject<string | null>;
  onChange: (value: string) => void;
  sanitizeAndNormalizeHtml: (value: string) => string;
  toolbarLabels: RichTextHtmlEditorToolbarLabels;
}>;

export function RichTextEditorHtml({
  id,
  labelId,
  describedBy,
  ariaInvalid,
  disabled,
  value,
  htmlDraft,
  setHtmlDraft,
  lastHtmlDraftEmission,
  onChange,
  sanitizeAndNormalizeHtml,
  toolbarLabels,
}: RichTextEditorHtmlProps) {
  const htmlModeLabelId = `${id}-html-mode-label`;
  return (
    <>
      <span id={htmlModeLabelId} className="sr-only">
        {toolbarLabels.htmlMode}
      </span>
      <Textarea
        id={`${id}-html`}
        aria-labelledby={labelId ? `${labelId} ${htmlModeLabelId}` : htmlModeLabelId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid || undefined}
        value={htmlDraft}
        readOnly={disabled}
        spellCheck={false}
        className="min-h-56 resize-y rounded-none border-0 bg-background px-4 py-3 font-mono text-sm leading-6 focus-visible:ring-0"
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          const sanitizedDraft = sanitizeAndNormalizeHtml(nextDraft);
          setHtmlDraft(nextDraft);
          lastHtmlDraftEmission.current = sanitizedDraft;
          onChange(sanitizedDraft);
        }}
        onBlur={() => {
          const sanitizedDraft = sanitizeAndNormalizeHtml(htmlDraft);
          setHtmlDraft(sanitizedDraft);
          if (sanitizedDraft !== value) {
            onChange(sanitizedDraft);
          }
        }}
      />
    </>
  );
}
