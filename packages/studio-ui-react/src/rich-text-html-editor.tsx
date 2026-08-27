import * as React from 'react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
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
import { sanitizeRichTextEditorHtml } from './rich-text-html-sanitizer.js';
import { Select } from './select.js';
import { Textarea } from './textarea.js';
import { cn } from './utils.js';

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

const createEmptyHtml = () => '<p></p>';

const normalizeEditorHtml = (value: string) =>
  value.trim().length > 0 ? value : createEmptyHtml();

const SAFE_LINK_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel']);

const normalizeLinkHref = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (!schemeMatch) {
    return `https://${trimmed}`;
  }

  return SAFE_LINK_PROTOCOLS.has(schemeMatch[1].toLowerCase()) ? trimmed : '';
};

const getHeadingLevel = (value: RichTextBlockTypeValue) =>
  value.startsWith('heading-')
    ? (Number(value.replace('heading-', '')) as 1 | 2 | 3 | 4 | 5 | 6)
    : null;

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

export const RichTextHtmlEditor = ({
  id,
  value,
  onChange,
  blockTypeOptions,
  toolbarLabels,
  labelId,
  describedBy,
  ariaInvalid = false,
  disabled = false,
  normalizeHtml,
  className,
}: RichTextHtmlEditorProps) => {
  const [mode, setMode] = React.useState<'visual' | 'html'>('visual');
  const sanitizeAndNormalizeHtml = React.useCallback(
    (nextValue: string) =>
      normalizeEditorHtml(
        sanitizeRichTextEditorHtml(normalizeHtml ? normalizeHtml(nextValue) : nextValue)
      ),
    [normalizeHtml]
  );
  const headingLevels = React.useMemo(
    () =>
      blockTypeOptions
        .map((option) => getHeadingLevel(option.value))
        .filter((level): level is 1 | 2 | 3 | 4 | 5 | 6 => level !== null),
    [blockTypeOptions]
  );
  const normalizedValue = React.useMemo(
    () => sanitizeAndNormalizeHtml(value),
    [sanitizeAndNormalizeHtml, value]
  );
  const [htmlDraft, setHtmlDraft] = React.useState(normalizedValue);
  const lastHtmlDraftEmission = React.useRef<string | null>(null);
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
        ...(ariaInvalid ? { 'aria-invalid': 'true' } : {}),
        ...(labelId ? { 'aria-labelledby': labelId } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: cn(
          'min-h-56 bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none',
          disabled ? 'cursor-not-allowed opacity-60' : '',
          '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
          '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:tracking-tight',
          '[&_h2]:mt-5 [&_h2]:mb-2.5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-tight',
          '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug',
          '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:leading-snug',
          '[&_h5]:mt-3 [&_h5]:mb-1.5 [&_h5]:text-base [&_h5]:font-semibold',
          '[&_h6]:mt-3 [&_h6]:mb-1.5 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:uppercase [&_h6]:tracking-wide',
          '[&_blockquote]:my-4 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50',
          '[&_blockquote]:bg-muted/40 [&_blockquote]:py-2 [&_blockquote]:pr-3 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
          '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6',
          '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6',
          '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/60 [&_a]:underline-offset-2',
          '[&_strong]:font-semibold [&_u]:underline [&_u]:underline-offset-2'
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextHtml = currentEditor.getHTML();
      onChange(sanitizeAndNormalizeHtml(nextHtml));
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

  React.useEffect(() => {
    if (mode !== 'html') {
      lastHtmlDraftEmission.current = null;
      setHtmlDraft(normalizedValue);
      return;
    }

    if (lastHtmlDraftEmission.current === normalizedValue) {
      lastHtmlDraftEmission.current = null;
      return;
    }

    setHtmlDraft(normalizedValue);
  }, [mode, normalizedValue]);

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
    const nextHref = globalThis.window?.prompt(toolbarLabels.linkPrompt, currentHref);

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

  const showVisualMode = React.useCallback(() => {
    if (!editor) {
      return;
    }

    const sanitizedDraft = sanitizeAndNormalizeHtml(htmlDraft);
    editor.commands.setContent(sanitizedDraft, {
      emitUpdate: false,
    });
    const normalizedHtml = sanitizeAndNormalizeHtml(editor.getHTML());
    setHtmlDraft(normalizedHtml);
    if (normalizedHtml !== value) {
      onChange(normalizedHtml);
    }
    setMode('visual');
  }, [editor, htmlDraft, onChange, sanitizeAndNormalizeHtml, value]);

  const showHtmlMode = React.useCallback(() => {
    lastHtmlDraftEmission.current = null;
    setHtmlDraft(normalizedValue);
    setMode('html');
  }, [normalizedValue]);

  const htmlModeLabelId = `${id}-html-mode-label`;
  const formattingDisabled = !editor || disabled || mode === 'html';

  return (
    <div
      data-rich-text-editor-id={id}
      className={cn(
        'overflow-hidden rounded-md border border-input bg-background shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        ariaInvalid ? 'border-destructive' : '',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-input bg-muted/40 p-1.5">
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
      <div hidden={mode === 'html'}>
        <EditorContent editor={editor} />
      </div>
      {mode === 'html' ? (
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
      ) : null}
    </div>
  );
};
