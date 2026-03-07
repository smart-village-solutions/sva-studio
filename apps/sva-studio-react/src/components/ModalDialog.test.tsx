import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModalDialog } from './ModalDialog';

afterEach(() => {
  cleanup();
});

describe('ModalDialog', () => {
  it('does not render when closed', () => {
    render(
      <ModalDialog open={false} title="Dialog" onClose={vi.fn()}>
        <button type="button">Action</button>
      </ModalDialog>
    );

    expect(screen.queryByRole('dialog', { name: 'Dialog' })).toBeNull();
  });

  it('renders dialog and closes on backdrop click', () => {
    const onClose = vi.fn();

    render(
      <ModalDialog open title="Dialog" onClose={onClose}>
        <button type="button">Action</button>
      </ModalDialog>
    );

    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Dialog' }).parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();

    render(
      <ModalDialog open title="Dialog" onClose={onClose}>
        <button type="button">Action</button>
      </ModalDialog>
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Dialog' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cycles focus with Tab from last to first element', () => {
    const onClose = vi.fn();

    render(
      <ModalDialog open title="Dialog" onClose={onClose}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </ModalDialog>
    );

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    expect(document.activeElement).toBe(first);
    second.focus();
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Dialog' }), { key: 'Tab' });

    expect(document.activeElement).toBe(first);
  });

  it('restores focus to trigger when dialog closes', () => {
    const DialogHost = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <ModalDialog open={open} title="Dialog" onClose={() => setOpen(false)}>
            <button type="button">Inside</button>
          </ModalDialog>
        </>
      );
    };

    render(<DialogHost />);

    const openButton = screen.getByRole('button', { name: 'Open' });
    openButton.focus();

    fireEvent.click(openButton);
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Dialog' }).parentElement as HTMLElement);

    expect(screen.queryByRole('dialog', { name: 'Dialog' })).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });
});
