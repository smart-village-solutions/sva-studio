import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const DialogExample = () => {
  return (
    <Dialog>
      <DialogTrigger>Dialog öffnen</DialogTrigger>
      <DialogContent className="custom-content">
        <DialogHeader className="custom-header">
          <DialogTitle>Dialogtitel</DialogTitle>
          <DialogDescription>Dialogbeschreibung</DialogDescription>
        </DialogHeader>
        <DialogFooter className="custom-footer">
          <DialogClose>Schließen</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

afterEach(() => {
  cleanup();
});

describe('ui/dialog', () => {
  it('opens and closes a dialog through the wrapped Radix primitives', () => {
    render(<DialogExample />);

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Dialog öffnen' }));

    const dialog = screen.getByRole('dialog', { name: 'Dialogtitel' });
    expect(dialog.className).toContain('custom-content');
    expect(screen.getByText('Dialogbeschreibung')).toBeTruthy();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('merges custom classes for overlay, header and footer helpers', () => {
    render(
      <Dialog open>
        <DialogOverlay className="custom-overlay" />
        <DialogContent>
          <DialogHeader className="custom-header">
            <DialogTitle>Titel</DialogTitle>
            <DialogDescription>Beschreibung</DialogDescription>
          </DialogHeader>
          <DialogFooter className="custom-footer">
            <span>Footer</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    expect(document.querySelector('[data-slot="dialog-overlay"]')?.className).toContain('custom-overlay');
    expect(screen.getByText('Titel').parentElement?.className).toContain('custom-header');
    expect(screen.getByText('Footer').parentElement?.className).toContain('custom-footer');
  });
});
