import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Sheet, SheetContent } from './sheet';

afterEach(() => {
  cleanup();
});

describe('Sheet', () => {
  it('does not render dialog content when closed', () => {
    render(
      <Sheet open={false} onOpenChange={vi.fn()}>
        <SheetContent aria-label="Navigation" closeLabel="Schließen">
          <button type="button">First</button>
        </SheetContent>
      </Sheet>
    );

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
  });

  it('closes on backdrop click', () => {
    const onOpenChange = vi.fn();

    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent aria-label="Navigation" closeLabel="Schließen">
          <button type="button">First</button>
        </SheetContent>
      </Sheet>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape key', () => {
    const onOpenChange = vi.fn();

    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent aria-label="Navigation" closeLabel="Schließen">
          <button type="button">First</button>
        </SheetContent>
      </Sheet>
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Navigation' }), { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cycles focus with Tab from last to first element', () => {
    render(
      <Sheet open onOpenChange={vi.fn()}>
        <SheetContent aria-label="Navigation" closeLabel="Schließen">
          <button type="button">First</button>
          <button type="button">Second</button>
        </SheetContent>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    expect(document.activeElement).toBe(first);
    second.focus();

    fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(document.activeElement).toBe(first);
  });

  it('cycles focus with Shift+Tab from first to last element', () => {
    render(
      <Sheet open onOpenChange={vi.fn()}>
        <SheetContent aria-label="Navigation" closeLabel="Schließen">
          <button type="button">First</button>
          <button type="button">Last</button>
        </SheetContent>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the trigger when the sheet closes', () => {
    const Host = () => {
      const [open, setOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent aria-label="Navigation" closeLabel="Schließen">
              <button type="button">Inside</button>
            </SheetContent>
          </Sheet>
        </>
      );
    };

    render(<Host />);

    const openButton = screen.getByRole('button', { name: 'Open' });
    openButton.focus();

    fireEvent.click(openButton);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });
});
