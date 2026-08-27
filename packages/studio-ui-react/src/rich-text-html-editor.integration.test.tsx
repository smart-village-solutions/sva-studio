// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { RichTextHtmlEditor } from './rich-text-html-editor.js';

const labels = {
  mode: 'Editoransicht',
  visualMode: 'WYSIWYG',
  htmlMode: 'HTML',
  blockType: 'Textformat',
  bulletList: 'Aufzählung',
  orderedList: 'Nummerierung',
  bold: 'Fett',
  italic: 'Kursiv',
  underline: 'Unterstrichen',
  clearFormatting: 'Formatierung entfernen',
  undo: 'Zurück',
  redo: 'Vorwärts',
  link: 'Link setzen',
  linkPrompt: 'Link-URL',
} as const;

function ControlledEditor({
  onChange,
  initialValue = '<p>Alpha Beta</p>',
}: Readonly<{ onChange?: (value: string) => void; initialValue?: string }>) {
  const [value, setValue] = React.useState(initialValue);

  return (
    <RichTextHtmlEditor
      id="integration-editor"
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange?.(nextValue);
      }}
      blockTypeOptions={[
        { value: 'paragraph', label: 'Absatz' },
        { value: 'heading-2', label: 'Überschrift 2' },
      ]}
      toolbarLabels={labels}
    />
  );
}

const selectAlpha = async (editor: HTMLElement) => {
  editor.focus();
  const paragraph = editor.querySelector('p');
  const textNode = paragraph
    ? document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode()
    : null;
  if (!textNode) {
    throw new Error('Editor text node is missing');
  }

  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 5);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('RichTextHtmlEditor integration', () => {
  beforeAll(() => {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [] as unknown as DOMRectList,
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => DOMRect.fromRect(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies links and headings to a real TipTap selection', async () => {
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      value: vi.fn(() => 'example.com'),
    });
    render(<ControlledEditor />);
    const editor = await screen.findByRole('textbox');

    await selectAlpha(editor);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Link setzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link setzen' }));
    await waitFor(() => expect(editor.innerHTML).toContain('<a'));
    expect(editor.innerHTML).toContain('href="https://example.com"');
    expect(editor.innerHTML).toContain('Alpha</a>');

    fireEvent.change(screen.getByRole('combobox', { name: 'Textformat' }), {
      target: { value: 'heading-2' },
    });
    await waitFor(() => expect(editor.innerHTML).toContain('<h2>'));
  });

  it('applies underline formatting to a real TipTap selection', async () => {
    render(<ControlledEditor />);
    const editor = await screen.findByRole('textbox');

    await selectAlpha(editor);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Unterstrichen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unterstrichen' }));

    await waitFor(() => expect(editor.innerHTML).toContain('<u>Alpha</u>'));
  });

  it('removes mixed formatting from a real TipTap selection', async () => {
    render(<ControlledEditor initialValue="<p><strong><em>Alpha</em></strong> Beta</p>" />);
    const editor = await screen.findByRole('textbox');

    await selectAlpha(editor);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Formatierung entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Formatierung entfernen' }));

    await waitFor(() => expect(editor.innerHTML).toContain('<p>Alpha Beta</p>'));
    expect(editor.innerHTML).not.toContain('<strong>');
    expect(editor.innerHTML).not.toContain('<em>');
  });

  it('normalizes source HTML through the configured TipTap schema before returning to WYSIWYG', async () => {
    const onChange = vi.fn();
    render(<ControlledEditor onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML' }), {
      target: { value: '<h2 data-unsupported="true">Überschrift</h2>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));

    const editor = await screen.findByRole('textbox');
    await waitFor(() => expect(editor.querySelector('h2')?.textContent).toBe('Überschrift'));
    expect(editor.innerHTML).not.toContain('data-unsupported');
    const normalizedHtml = onChange.mock.lastCall?.[0];
    expect(normalizedHtml).toContain('<h2>Überschrift</h2>');
    expect(normalizedHtml).not.toContain('data-unsupported');
  });
});
