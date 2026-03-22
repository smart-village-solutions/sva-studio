import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor', () => {
  afterEach(() => {
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

    if (execCommandDescriptor) {
      Object.defineProperty(document, 'execCommand', execCommandDescriptor);
    } else {
      // Keep the document shape intact for subsequent tests.
      Reflect.deleteProperty(document, 'execCommand');
    }
  });
});
