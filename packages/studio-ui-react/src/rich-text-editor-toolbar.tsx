import * as React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  CodeXml,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
} from 'lucide-react';

import { Button } from './button.js';
import { Select } from './select.js';
import type {
  RichTextBlockTypeOption,
  RichTextBlockTypeValue,
  RichTextHtmlEditorToolbarLabels,
} from './rich-text-editor-types.js';
import { cn } from './utils.js';
import { getHeadingLevel } from './rich-text-editor-utils.js';

type ToolbarButtonProps = Readonly<{
  active?: boolean;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}>;

const ToolbarButton = ({
  active,
  children,
  label,
  disabled = false,
  onClick,
}: ToolbarButtonProps) => (
  <Button
    type="button"
    size="icon"
    variant="tertiary"
    aria-label={label}
    title={label}
    aria-pressed={active}
    disabled={disabled}
    className={cn(
      'h-8 w-8 rounded-sm border border-transparent text-muted-foreground shadow-none',
      'hover:border-border hover:bg-background hover:text-foreground',
      active ? 'border-border bg-background text-foreground shadow-sm' : ''
    )}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
  >
    {children}
  </Button>
);

type RichTextEditorToolbarProps = Readonly<{
  editor: Editor | null;
  mode: 'visual' | 'html';
  disabled: boolean;
  blockTypeOptions: readonly RichTextBlockTypeOption[];
  toolbarLabels: RichTextHtmlEditorToolbarLabels;
  activeFormat: RichTextBlockTypeValue;
  applyLink: () => void;
  showVisualMode: () => void;
  showHtmlMode: () => void;
}>;

type BlockTypeSelectProps = Pick<
  RichTextEditorToolbarProps,
  'editor' | 'blockTypeOptions' | 'toolbarLabels' | 'activeFormat'
> &
  Readonly<{ formattingDisabled: boolean }>;

function BlockTypeSelect({
  editor,
  blockTypeOptions,
  toolbarLabels,
  activeFormat,
  formattingDisabled,
}: BlockTypeSelectProps) {
  return (
    <Select
      aria-label={toolbarLabels.blockType}
      disabled={formattingDisabled}
      className="h-8 w-auto min-w-40 rounded-md border-input bg-background text-sm shadow-sm focus-visible:ring-2"
      value={activeFormat}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        if (!editor) {
          return;
        }

        if (nextValue === 'paragraph') {
          editor.chain().focus().setParagraph().run();
          return;
        }

        if (nextValue === 'blockquote') {
          editor.chain().focus().setParagraph().toggleBlockquote().run();
          return;
        }

        if (nextValue.startsWith('heading-')) {
          const level = getHeadingLevel(nextValue as RichTextBlockTypeValue);
          if (level === null) {
            return;
          }

          editor.chain().focus().toggleHeading({ level }).run();
        }
      }}
    >
      {blockTypeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

type TextFormattingControlsProps = Pick<
  RichTextEditorToolbarProps,
  'editor' | 'toolbarLabels' | 'applyLink'
> &
  Readonly<{ formattingDisabled: boolean }>;

function TextFormattingControls({
  editor,
  toolbarLabels,
  applyLink,
  formattingDisabled,
}: TextFormattingControlsProps) {
  return (
    <div className="flex items-center gap-0.5 border-l border-border pl-1.5">
      <ToolbarButton
        label={String(toolbarLabels.link)}
        active={editor?.isActive('link') ?? false}
        disabled={formattingDisabled}
        onClick={applyLink}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label={String(toolbarLabels.bold)}
        active={editor?.isActive('bold') ?? false}
        disabled={formattingDisabled}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label={String(toolbarLabels.italic)}
        active={editor?.isActive('italic') ?? false}
        disabled={formattingDisabled}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label={String(toolbarLabels.underline)}
        active={editor?.isActive('underline') ?? false}
        disabled={formattingDisabled}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label={String(toolbarLabels.clearFormatting)}
        disabled={formattingDisabled}
        onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditorToolbar({
  editor,
  mode,
  disabled,
  blockTypeOptions,
  toolbarLabels,
  activeFormat,
  applyLink,
  showVisualMode,
  showHtmlMode,
}: RichTextEditorToolbarProps) {
  const formattingDisabled = !editor || disabled || mode === 'html';
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-input bg-muted/40 p-1.5">
      <BlockTypeSelect
        editor={editor}
        blockTypeOptions={blockTypeOptions}
        toolbarLabels={toolbarLabels}
        activeFormat={activeFormat}
        formattingDisabled={formattingDisabled}
      />
      <div className="flex items-center gap-0.5 border-l border-border pl-1.5">
        <ToolbarButton
          label={String(toolbarLabels.bulletList)}
          active={editor?.isActive('bulletList') ?? false}
          disabled={formattingDisabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.orderedList)}
          active={editor?.isActive('orderedList') ?? false}
          disabled={formattingDisabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <TextFormattingControls
        editor={editor}
        toolbarLabels={toolbarLabels}
        applyLink={applyLink}
        formattingDisabled={formattingDisabled}
      />
      <div className="flex items-center gap-0.5 border-l border-border pl-1.5">
        <ToolbarButton
          label={String(toolbarLabels.undo)}
          disabled={formattingDisabled}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.redo)}
          disabled={formattingDisabled}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className="ml-auto flex items-center border-l border-border pl-1.5">
        <ToolbarButton
          label={String(toolbarLabels.htmlMode)}
          active={mode === 'html'}
          onClick={mode === 'html' ? showVisualMode : showHtmlMode}
        >
          <CodeXml className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}
