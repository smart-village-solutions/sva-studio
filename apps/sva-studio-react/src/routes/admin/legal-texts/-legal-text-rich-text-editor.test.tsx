import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LegalTextRichTextEditor } from './-legal-text-rich-text-editor';

describe('LegalTextRichTextEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses the shared editor modes and sanitizes raw HTML when source editing finishes', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LegalTextRichTextEditor
        id="legal-content"
        labelId="legal-content-label"
        value="<p>Rechtstext</p>"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    const source = screen.getByRole('textbox', { name: 'HTML' });
    fireEvent.change(source, {
      target: { value: '<p>Neu</p><script>alert(1)</script>' },
    });
    expect(onChange).toHaveBeenLastCalledWith('<p>Neu</p><script>alert(1)</script>');

    rerender(
      <LegalTextRichTextEditor
        id="legal-content"
        labelId="legal-content-label"
        value="<p>Neu</p><script>alert(1)</script>"
        onChange={onChange}
      />
    );
    fireEvent.blur(screen.getByRole('textbox', { name: 'HTML' }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<p>Neu</p>'));
  });

  it('keeps the HTML source selectable but read-only without update permission', async () => {
    render(
      <LegalTextRichTextEditor
        id="legal-content"
        labelId="legal-content-label"
        value="<p>Rechtstext</p>"
        onChange={vi.fn()}
        disabled
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));

    expect(screen.getByRole('textbox', { name: 'HTML' })).toHaveProperty('readOnly', true);
  });
});
