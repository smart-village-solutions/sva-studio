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
});
