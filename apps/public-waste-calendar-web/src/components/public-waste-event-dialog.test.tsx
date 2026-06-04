import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PublicWasteEventDialog } from './public-waste-event-dialog.js';

describe('PublicWasteEventDialog', () => {
  it('focuses the close button and closes on escape', () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <PublicWasteEventDialog
        entry={{
          id: 'pickup-1',
          date: '2026-05-19',
          fractionId: 'bio',
          fractionLabel: 'Bioabfall',
          tourName: 'Biotour Nord',
          tourDescription: 'Wöchentliche Leerung im Innenstadtbereich.',
          note: 'Bitte rausstellen.',
        }}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: 'Schließen' });
    expect(document.activeElement).toBe(closeButton);
    expect(screen.getByText('Biotour Nord')).toBeTruthy();
    expect(screen.getByText('Hinweis')).toBeTruthy();
    expect(screen.getByText('Wöchentliche Leerung im Innenstadtbereich.')).toBeTruthy();
    expect(screen.getByText('Bitte rausstellen.')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
