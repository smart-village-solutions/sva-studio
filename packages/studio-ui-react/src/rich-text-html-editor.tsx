import * as React from 'react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';

import { Button } from './button.js';
import { Select } from './select.js';
import { cn } from './utils.js';

export type RichTextBlockTypeValue = 'paragraph' | 'blockquote' | `heading-${1 | 2 | 3 | 4 | 5 | 6}`;

export type RichTextBlockTypeOption = Readonly<{
  value: RichTextBlockTypeValue;
  label: React.ReactNode;
}>;

export type RichTextHtmlEditorToolbarLabels = Readonly<{
  blockType: string;
  bulletList: React.ReactNode;
  orderedList: React.ReactNode;
  bold: React.ReactNode;
  italic: React.ReactNode;
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
  disabled?: boolean;
  className?: string;
}>;

const createEmptyHtml = () => '<p></p>';

const normalizeEditorHtml = (value: string) => (value.trim().length > 0 ? value : createEmptyHtml());

const normalizeLinkHref = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getHeadingLevel = (value: RichTextBlockTypeValue) =>
  value.startsWith('heading-') ? (Number(value.replace('heading-', '')) as 1 | 2 | 3 | 4 | 5 | 6) : null;

type ToolbarButtonProps = Readonly<{
  active?: boolean;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}>;

const ToolbarButton = ({ active = false, children, label, disabled = false, onClick }: ToolbarButtonProps) => (
  <Button
    type="button"
    size="icon"
    variant="ghost"
    aria-label={label}
    title={label}
    disabled={disabled}
    className={cn(
      'h-10 w-10 rounded-none border-l border-border text-muted-foreground hover:bg-muted hover:text-foreground',
      active ? 'bg-muted text-foreground' : ''
    )}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
  >
    {children}
  </Button>
);

export const RichTextHtmlEditor = ({
  id,
  value,
  onChange,
  blockTypeOptions,
  toolbarLabels,
  labelId,
  describedBy,
  disabled = false,
  className,
}: RichTextHtmlEditorProps) => {
  const headingLevels = React.useMemo(
    () =>
      blockTypeOptions
        .map((option) => getHeadingLevel(option.value))
        .filter((level): level is 1 | 2 | 3 | 4 | 5 | 6 => level !== null),
    [blockTypeOptions]
  );
  const normalizedValue = React.useMemo(() => normalizeEditorHtml(value), [value]);
  const editor = useEditor({
    immediatelyRender: false,
    editable: disabled === false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: headingLevels,
        },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        ...(labelId ? { 'aria-labelledby': labelId } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: cn(
          'min-h-56 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background',
          'focus-visible:ring-2 focus-visible:ring-ring',
          disabled ? 'cursor-not-allowed opacity-60' : '',
          '[&_.ProseMirror]:min-h-52 [&_.ProseMirror]:outline-none',
          '[&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold',
          '[&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold',
          '[&_.ProseMirror_h4]:mt-3 [&_.ProseMirror_h4]:text-lg [&_.ProseMirror_h4]:font-semibold',
          '[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6',
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6',
          '[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline'
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  React.useEffect(() => {
    if (!editor) {
      return;
    }

    if (editor.getHTML() !== normalizedValue) {
      editor.commands.setContent(normalizedValue, {
        emitUpdate: false,
      });
    }
  }, [editor, normalizedValue]);

  const activeFormat = React.useMemo(() => {
    if (!editor) {
      return 'paragraph';
    }

    for (const option of blockTypeOptions) {
      const headingLevel = getHeadingLevel(option.value);
      if (headingLevel !== null && editor.isActive('heading', { level: headingLevel })) {
        return option.value;
      }
    }

    if (editor.isActive('blockquote')) {
      return 'blockquote';
    }

    return 'paragraph';
  }, [editor, blockTypeOptions]);

  const applyLink = React.useCallback(() => {
    if (!editor) {
      return;
    }

    const currentHref = editor.getAttributes('link').href ?? '';
    const nextHref = globalThis.window?.prompt(
      toolbarLabels.linkPrompt,
      currentHref
    );

    if (nextHref === null) {
      return;
    }

    const href = normalizeLinkHref(nextHref);
    if (href.length === 0) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor, toolbarLabels.linkPrompt]);

  return (
    <div className={cn('overflow-hidden rounded-md border border-input bg-background', className)}>
      <div className="flex flex-wrap items-stretch border-b border-input">
        <Select
          aria-label={toolbarLabels.blockType}
          disabled={!editor || disabled}
          className="h-10 w-auto min-w-40 rounded-none border-0 border-r border-border bg-background text-sm shadow-none focus-visible:ring-0"
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
        <ToolbarButton
          label={String(toolbarLabels.bulletList)}
          active={editor?.isActive('bulletList') ?? false}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.orderedList)}
          active={editor?.isActive('orderedList') ?? false}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.link)}
          active={editor?.isActive('link') ?? false}
          disabled={!editor || disabled}
          onClick={applyLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.bold)}
          active={editor?.isActive('bold') ?? false}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.italic)}
          active={editor?.isActive('italic') ?? false}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.undo)}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={String(toolbarLabels.redo)}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
