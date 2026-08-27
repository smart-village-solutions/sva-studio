// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RichTextHtmlEditor } from './rich-text-html-editor.js';

const tiptapState = vi.hoisted(() => {
  const actions: string[] = [];
  const calls = {
    setContent: vi.fn(),
    setLink: vi.fn(),
  };
  let html = '<p>Initial</p>';
  let linkHref = '';

  const chain = {
    focus: vi.fn(() => chain),
    toggleHeading: vi.fn(({ level }: { level: number }) => {
      actions.push(`heading:${level}`);
      return chain;
    }),
    setParagraph: vi.fn(() => {
      actions.push('paragraph');
      return chain;
    }),
    toggleBlockquote: vi.fn(() => {
      actions.push('blockquote');
      return chain;
    }),
    toggleBulletList: vi.fn(() => {
      actions.push('bulletList');
      return chain;
    }),
    toggleOrderedList: vi.fn(() => {
      actions.push('orderedList');
      return chain;
    }),
    toggleBold: vi.fn(() => {
      actions.push('bold');
      return chain;
    }),
    toggleItalic: vi.fn(() => {
      actions.push('italic');
      return chain;
    }),
    toggleUnderline: vi.fn(() => {
      actions.push('underline');
      return chain;
    }),
    undo: vi.fn(() => {
      actions.push('undo');
      return chain;
    }),
    redo: vi.fn(() => {
      actions.push('redo');
      return chain;
    }),
    extendMarkRange: vi.fn(() => chain),
    setLink: vi.fn(({ href }: { href: string }) => {
      linkHref = href;
      calls.setLink(href);
      actions.push(`setLink:${href}`);
      return chain;
    }),
    unsetLink: vi.fn(() => {
      linkHref = '';
      actions.push('unsetLink');
      return chain;
    }),
    run: vi.fn(() => true),
  };

  const editor = {
    isActive: vi.fn(() => false),
    chain: vi.fn(() => chain),
    getHTML: vi.fn(() => html),
    getAttributes: vi.fn(() => ({ href: linkHref })),
    commands: {
      setContent: vi.fn((nextHtml: string) => {
        html = nextHtml;
        calls.setContent(nextHtml);
        return true;
      }),
    },
  };

  return {
    actions,
    calls,
    editor,
    get html() {
      return html;
    },
    set html(value: string) {
      html = value;
    },
    reset() {
      actions.length = 0;
      html = '<p>Initial</p>';
      linkHref = '';
      calls.setContent.mockReset();
      calls.setLink.mockReset();
      editor.isActive.mockReset();
      editor.isActive.mockReturnValue(false);
      editor.chain.mockClear();
      editor.getHTML.mockClear();
      editor.getHTML.mockImplementation(() => html);
      editor.getAttributes.mockClear();
      editor.getAttributes.mockImplementation(() => ({ href: linkHref }));
      editor.commands.setContent.mockClear();
      editor.commands.setContent.mockImplementation((nextHtml: string) => {
        html = nextHtml;
        calls.setContent(nextHtml);
        return true;
      });
      for (const action of Object.values(chain)) {
        action.mockClear();
      }
    },
  };
});

const useEditorMock = vi.hoisted(() => vi.fn());

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: typeof tiptapState.editor | null }) => (
    <div
      id="mock-editor"
      role="textbox"
      aria-multiline="true"
      dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? '' }}
    />
  ),
  useEditor: (...args: unknown[]) => useEditorMock(...args),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: (options: unknown) => ({ name: 'starter-kit', options }),
  },
}));

vi.mock('@tiptap/extension-link', () => ({
  default: {
    configure: (options: unknown) => ({ name: 'link', options }),
  },
}));

const renderEditor = (props?: Partial<React.ComponentProps<typeof RichTextHtmlEditor>>) => {
  const onChange = vi.fn();
  const createEditor = (nextProps?: Partial<React.ComponentProps<typeof RichTextHtmlEditor>>) => (
    <RichTextHtmlEditor
      id="poi-description"
      value="<p>Initial</p>"
      onChange={onChange}
      blockTypeOptions={[
        { value: 'paragraph', label: 'Absatz' },
        { value: 'heading-2', label: 'H2' },
        { value: 'heading-3', label: 'H3' },
        { value: 'blockquote', label: 'Zitat' },
      ]}
      toolbarLabels={{
        mode: 'Editoransicht',
        visualMode: 'WYSIWYG',
        htmlMode: 'HTML',
        blockType: 'Textformat',
        bulletList: 'UL',
        orderedList: 'OL',
        bold: 'Fett',
        italic: 'Kursiv',
        underline: 'Unterstrichen',
        clearFormatting: 'Formatierung entfernen',
        undo: 'Zurück',
        redo: 'Vorwärts',
        linkPrompt: 'Link-URL',
        link: 'Link setzen',
      }}
      {...nextProps}
    />
  );
  const rendered = render(createEditor(props));

  return {
    onChange,
    rerenderEditor: (nextProps: Partial<React.ComponentProps<typeof RichTextHtmlEditor>>) =>
      rendered.rerender(createEditor({ ...props, ...nextProps })),
  };
};

describe('RichTextHtmlEditor', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    tiptapState.reset();
    useEditorMock.mockReset();
    useEditorMock.mockReturnValue(tiptapState.editor);
  });

  it('renders the configured heading and formatting controls', () => {
    renderEditor();

    expect(screen.getByRole('combobox', { name: 'Textformat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'UL' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OL' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Link setzen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fett' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kursiv' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unterstrichen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Formatierung entfernen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vorwärts' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Editoransicht' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Editoransicht' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fett' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Zurück' }).getAttribute('aria-pressed')).toBeNull();
    expect(screen.getByRole('button', { name: 'WYSIWYG' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByRole('button', { name: 'HTML' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to an editable HTML source view and back to the normalized visual value', () => {
    const { onChange, rerenderEditor } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));

    const htmlSource = screen.getByRole('textbox', { name: 'HTML' });
    expect(htmlSource).toHaveProperty('value', '<p>Initial</p>');
    expect(screen.getByRole('button', { name: 'HTML' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Textformat' })).toHaveProperty('disabled', true);

    fireEvent.change(htmlSource, { target: { value: '<h2>Geändert</h2>' } });
    expect(onChange).toHaveBeenLastCalledWith('<h2>Geändert</h2>');

    rerenderEditor({ value: '<h2>Geändert</h2>' });
    fireEvent.click(screen.getByRole('button', { name: 'WYSIWYG' }));

    expect(tiptapState.calls.setContent).toHaveBeenLastCalledWith('<h2>Geändert</h2>');
    expect(screen.getByRole('button', { name: 'WYSIWYG' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('keeps raw source editable while only forwarding sanitized html', () => {
    const { onChange } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    const htmlSource = screen.getByRole('textbox', { name: 'HTML' });
    const unsafeHtml =
      '<h2 onclick="alert(1)">Titel</h2><script>alert(1)</script><a href="javascript:alert(1)">Link</a>';

    fireEvent.change(htmlSource, { target: { value: unsafeHtml } });

    expect(htmlSource).toHaveProperty('value', unsafeHtml);
    expect(onChange).toHaveBeenLastCalledWith('<h2>Titel</h2><a>Link</a>');

    fireEvent.blur(htmlSource);
    expect(htmlSource).toHaveProperty('value', '<h2>Titel</h2><a>Link</a>');
  });

  it('reconciles external values in HTML mode without replacing the active raw draft acknowledgement', () => {
    const { rerenderEditor } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    const htmlSource = screen.getByRole('textbox', { name: 'HTML' });
    const rawDraft = '<p onclick="alert(1)">Entwurf</p>';
    fireEvent.change(htmlSource, { target: { value: rawDraft } });

    rerenderEditor({ value: '<p>Entwurf</p>' });
    expect(htmlSource).toHaveProperty('value', rawDraft);

    rerenderEditor({ value: '<h2>Extern geladen</h2>' });
    expect(htmlSource).toHaveProperty('value', '<h2>Extern geladen</h2>');
  });

  it('preserves the code and strike markup enabled by StarterKit', () => {
    const { onChange } = renderEditor();
    const starterKitHtml = '<pre><code>const value = 1;</code></pre><p><s>Alt</s></p>';

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML' }), {
      target: { value: starterKitHtml },
    });

    expect(onChange).toHaveBeenLastCalledWith(starterKitHtml);
  });

  it('keeps the source view labelled and read-only while the editor is disabled', () => {
    renderEditor({ disabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));

    const htmlSource = screen.getByRole('textbox', { name: 'HTML' });
    expect(htmlSource).toHaveProperty('readOnly', true);
  });

  it('applies normalized https links through the toolbar', () => {
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'example.com'),
    });
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Link setzen' }));

    expect(tiptapState.calls.setLink).toHaveBeenCalledWith('https://example.com');
    expect(tiptapState.actions).toContain('setLink:https://example.com');
  });

  it('runs the remaining toolbar actions and prevents focus loss on mouse down', () => {
    tiptapState.editor.isActive.mockImplementation(
      (name: string) => name === 'bold' || name === 'bulletList'
    );

    renderEditor();

    const bulletListButton = screen.getByRole('button', { name: 'UL' });
    const orderedListButton = screen.getByRole('button', { name: 'OL' });
    const boldButton = screen.getByRole('button', { name: 'Fett' });
    const italicButton = screen.getByRole('button', { name: 'Kursiv' });
    const underlineButton = screen.getByRole('button', { name: 'Unterstrichen' });
    const undoButton = screen.getByRole('button', { name: 'Zurück' });
    const redoButton = screen.getByRole('button', { name: 'Vorwärts' });

    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    bulletListButton.dispatchEvent(mouseDownEvent);

    fireEvent.click(bulletListButton);
    fireEvent.click(orderedListButton);
    fireEvent.click(boldButton);
    fireEvent.click(italicButton);
    fireEvent.click(underlineButton);
    fireEvent.click(undoButton);
    fireEvent.click(redoButton);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
    expect(bulletListButton.className).toContain('bg-background');
    expect(bulletListButton.className).toContain('border-border');
    expect(boldButton.className).toContain('bg-background');
    expect(boldButton.className).toContain('border-border');
    expect(tiptapState.actions).toEqual(
      expect.arrayContaining([
        'bulletList',
        'orderedList',
        'bold',
        'italic',
        'underline',
        'undo',
        'redo',
      ])
    );
  });

  it('syncs external html updates and forwards editor updates', () => {
    const { onChange } = renderEditor({ value: '<p>Alpha</p>' });

    expect(tiptapState.calls.setContent).toHaveBeenCalledWith('<p>Alpha</p>');

    tiptapState.html = '<p>Beta</p>';
    const config = useEditorMock.mock.calls[0]?.[0] as {
      onUpdate?: (input: { editor: typeof tiptapState.editor }) => void;
    };
    config.onUpdate?.({ editor: tiptapState.editor });

    expect(onChange).toHaveBeenCalledWith('<p>Beta</p>');
  });

  it('switches paragraph, blockquote and heading formats through the block type select', () => {
    renderEditor();

    fireEvent.change(screen.getByRole('combobox', { name: 'Textformat' }), {
      target: { value: 'paragraph' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Textformat' }), {
      target: { value: 'blockquote' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Textformat' }), {
      target: { value: 'heading-2' },
    });

    expect(tiptapState.actions).toEqual(
      expect.arrayContaining(['paragraph', 'blockquote', 'heading:2'])
    );
  });

  it('reflects the active heading format in the block type select', () => {
    tiptapState.editor.isActive.mockImplementation(
      (name: string, attrs?: { level?: number }) => name === 'heading' && attrs?.level === 2
    );

    renderEditor();

    expect(screen.getByRole('combobox', { name: 'Textformat' })).toHaveProperty(
      'value',
      'heading-2'
    );
  });

  it('reflects an active blockquote format in the block type select', () => {
    tiptapState.editor.isActive.mockImplementation((name: string) => name === 'blockquote');

    renderEditor();

    expect(screen.getByRole('combobox', { name: 'Textformat' })).toHaveProperty(
      'value',
      'blockquote'
    );
  });

  it('removes links when the prompt returns an empty value and ignores cancelled prompts', () => {
    tiptapState.editor.getAttributes.mockReturnValue({ href: 'https://example.com' });
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValueOnce('').mockReturnValueOnce(null),
    });

    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Link setzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link setzen' }));

    expect(tiptapState.actions).toContain('unsetLink');
    expect(tiptapState.calls.setLink).not.toHaveBeenCalled();
  });

  it('rejects unsafe link protocols from the toolbar prompt', () => {
    tiptapState.editor.getAttributes.mockReturnValue({ href: 'https://example.com' });
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'javascript:alert(1)'),
    });

    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Link setzen' }));

    expect(tiptapState.actions).toContain('unsetLink');
    expect(tiptapState.calls.setLink).not.toHaveBeenCalled();
  });

  it('disables toolbar controls when the editor is disabled', () => {
    renderEditor({ disabled: true });

    expect(screen.getByRole('combobox', { name: 'Textformat' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Link setzen' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Fett' })).toHaveProperty('disabled', true);
  });

  it('normalizes empty html input and keeps absolute link schemes unchanged', () => {
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'mailto:test@example.com'),
    });

    renderEditor({ value: '   ' });

    expect(tiptapState.calls.setContent).toHaveBeenCalledWith('<p></p>');

    fireEvent.click(screen.getByRole('button', { name: 'Link setzen' }));

    expect(tiptapState.calls.setLink).toHaveBeenCalledWith('mailto:test@example.com');
  });

  it('wires aria labelling attributes through to the editor surface', () => {
    renderEditor({ labelId: 'editor-label', describedBy: 'editor-help' });

    const config = useEditorMock.mock.calls[0]?.[0] as {
      editorProps?: { attributes?: Record<string, string> };
    };

    expect(config.editorProps?.attributes).toMatchObject({
      'aria-labelledby': 'editor-label',
      'aria-describedby': 'editor-help',
    });
  });

  it('falls back safely when no editor instance is available', () => {
    useEditorMock.mockReturnValue(null);

    renderEditor();

    expect(screen.getByRole('combobox', { name: 'Textformat' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'UL' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Link setzen' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('textbox').innerHTML).toBe('');
  });
});
