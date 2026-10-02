import * as React from 'react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';

import { RichTextEditorHtml } from './rich-text-editor-html.js';
import { RichTextEditorToolbar } from './rich-text-editor-toolbar.js';
import {
  getHeadingLevel,
  normalizeEditorHtml,
  normalizeLinkHref,
} from './rich-text-editor-utils.js';
import type { RichTextHtmlEditorProps } from './rich-text-editor-types.js';
import { sanitizeRichTextEditorHtml } from './rich-text-html-sanitizer.js';
import { cn } from './utils.js';

export type {
  RichTextBlockTypeValue,
  RichTextBlockTypeOption,
  RichTextHtmlEditorToolbarLabels,
  RichTextHtmlEditorProps,
} from './rich-text-editor-types.js';

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
      <RichTextEditorToolbar
        editor={editor}
        mode={mode}
        disabled={disabled}
        blockTypeOptions={blockTypeOptions}
        toolbarLabels={toolbarLabels}
        activeFormat={activeFormat}
        applyLink={applyLink}
        showVisualMode={showVisualMode}
        showHtmlMode={showHtmlMode}
      />
      <div hidden={mode === 'html'}>
        <EditorContent editor={editor} />
      </div>
      {mode === 'html' ? (
        <RichTextEditorHtml
          id={id}
          labelId={labelId}
          describedBy={describedBy}
          ariaInvalid={ariaInvalid}
          disabled={disabled}
          value={value}
          htmlDraft={htmlDraft}
          setHtmlDraft={setHtmlDraft}
          lastHtmlDraftEmission={lastHtmlDraftEmission}
          onChange={onChange}
          sanitizeAndNormalizeHtml={sanitizeAndNormalizeHtml}
          toolbarLabels={toolbarLabels}
        />
      ) : null}
    </div>
  );
};
