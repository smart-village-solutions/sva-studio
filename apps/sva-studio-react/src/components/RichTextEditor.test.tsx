import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps working when execCommand is not available', () => {
    const onChange = vi.fn();
    const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    render(
      <RichTextEditor
        id="editor"
        labelId="editor-label"
        value="<p>Hallo</p>"
        onChange={onChange}
        placeholder="Start"
        commands={{
          bold: 'Fett',
          italic: 'Kursiv',
          underline: 'Unterstrichen',
          paragraph: 'Absatz',
          heading: 'Überschrift',
          bulletList: 'Liste',
          clearFormatting: 'Formatierung entfernen',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fett' }));

    expect(onChange).toHaveBeenCalled();
    expect(document.getElementById('editor')?.getAttribute('aria-describedby')).toBe('editor-placeholder');
    expect(screen.getByText('Start').className).toContain('sr-only');

    if (execCommandDescriptor) {
      Object.defineProperty(document, 'execCommand', execCommandDescriptor);
    } else {
      // Keep the document shape intact for subsequent tests.
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('skips commands when execCommand throws', () => {
    const onChange = vi.fn();
    const execCommand = vi.fn(() => {
      throw new Error('unsupported');
    });

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommand,
    });

    render(
      <RichTextEditor
        id="editor"
        labelId="editor-label"
        value="<p>Hallo</p>"
        onChange={onChange}
        commands={{
          bold: 'Fett',
          italic: 'Kursiv',
          underline: 'Unterstrichen',
          paragraph: 'Absatz',
          heading: 'Überschrift',
          bulletList: 'Liste',
          clearFormatting: 'Formatierung entfernen',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fett' }));

    expect(execCommand).toHaveBeenCalledWith('bold', false, undefined);
    expect(onChange).toHaveBeenCalled();
  });

  it('sanitizes incoming and outgoing html content', () => {
    const onChange = vi.fn();

    render(
      <RichTextEditor
        id="editor"
        labelId="editor-label"
        value={'<p>Hallo</p><script>alert(1)</script><a href="https://example.com" target="_blank">Link</a>'}
        onChange={onChange}
        commands={{
          bold: 'Fett',
          italic: 'Kursiv',
          underline: 'Unterstrichen',
          paragraph: 'Absatz',
          heading: 'Überschrift',
          bulletList: 'Liste',
          clearFormatting: 'Formatierung entfernen',
        }}
      />
    );

    expect(document.getElementById('editor')?.innerHTML).toBe(
      '<p>Hallo</p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>'
    );
    expect(onChange).toHaveBeenCalledWith(
      '<p>Hallo</p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>'
    );

    fireEvent.input(document.getElementById('editor') as HTMLElement, {
      target: {
        innerHTML: '<p>Neu</p><img src=x onerror=alert(1)>',
      },
    });

    expect(onChange).toHaveBeenLastCalledWith('<p>Neu</p>');
  });

  it('exposes textbox semantics for keyboard and assistive technology', () => {
    const onChange = vi.fn();

    render(
      <RichTextEditor
        id="editor"
        labelId="editor-label"
        value="<p>Hallo</p>"
        onChange={onChange}
        commands={{
          bold: 'Fett',
          italic: 'Kursiv',
          underline: 'Unterstrichen',
          paragraph: 'Absatz',
          heading: 'Überschrift',
          bulletList: 'Liste',
          clearFormatting: 'Formatierung entfernen',
        }}
      />
    );

    const editor = document.getElementById('editor');
    expect(editor?.getAttribute('role')).toBe('textbox');
    expect(editor?.getAttribute('aria-multiline')).toBe('true');
    expect(editor?.getAttribute('tabindex')).toBe('0');
  });
});
