import type * as React from 'react';

export type RichTextBlockTypeValue =
  'paragraph' | 'blockquote' | `heading-${1 | 2 | 3 | 4 | 5 | 6}`;

export type RichTextBlockTypeOption = Readonly<{
  value: RichTextBlockTypeValue;
  label: React.ReactNode;
}>;

export type RichTextHtmlEditorToolbarLabels = Readonly<{
  mode: string;
  visualMode: React.ReactNode;
  htmlMode: React.ReactNode;
  blockType: string;
  bulletList: React.ReactNode;
  orderedList: React.ReactNode;
  bold: React.ReactNode;
  italic: React.ReactNode;
  underline: React.ReactNode;
  clearFormatting: React.ReactNode;
  undo: React.ReactNode;
  redo: React.ReactNode;
  link: React.ReactNode;
  linkPrompt: string;
}>;

export type RichTextHtmlEditorProps = Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  blockTypeOptions: readonly RichTextBlockTypeOption[];
  toolbarLabels: RichTextHtmlEditorToolbarLabels;
  labelId?: string;
  describedBy?: string;
  ariaInvalid?: boolean;
  disabled?: boolean;
  normalizeHtml?: (value: string) => string;
  className?: string;
}>;
