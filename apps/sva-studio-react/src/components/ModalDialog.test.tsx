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

    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement);

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

  it('cycles focus with Shift+Tab from first to last element', () => {
    const onClose = vi.fn();

    render(
      <ModalDialog open title="Dialog" onClose={onClose}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </ModalDialog>
    );

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Dialog' }), { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it('ignores Tab focus trap when no focusable elements are present', () => {
    render(
      <ModalDialog open title="Dialog" onClose={vi.fn()}>
        <div>Static Content</div>
      </ModalDialog>
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Dialog' }), { key: 'Tab' });

    expect(screen.getByText('Static Content')).toBeTruthy();
  });

  it('ignores non-Tab keys in focus trap handler', () => {
    const onClose = vi.fn();

    render(
      <ModalDialog open title="Dialog" onClose={onClose}>
        <button type="button">Only Button</button>
      </ModalDialog>
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Dialog' }), { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Only Button' })).toBeTruthy();
  });

  it('stops mousedown propagation inside panel', () => {
    const onClose = vi.fn();

    render(
      <ModalDialog open title="Dialog" onClose={onClose}>
        <button type="button">Inside</button>
      </ModalDialog>
    );

    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Dialog' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders optional description text', () => {
    render(
      <ModalDialog open title="Dialog" description="Dialog Beschreibung" onClose={vi.fn()}>
        <button type="button">Inside</button>
      </ModalDialog>
    );

    expect(screen.getByText('Dialog Beschreibung')).toBeTruthy();
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

    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement);

    expect(screen.queryByRole('dialog', { name: 'Dialog' })).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });

  it('keeps focus on the active field while controlled inputs rerender inside the dialog', () => {
    const DialogHost = () => {
      const [description, setDescription] = React.useState('');

      return (
        <ModalDialog open title="Dialog" onClose={() => undefined}>
          <label>
            <span>First</span>
            <input type="text" value="fixed" readOnly />
          </label>
          <label>
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </ModalDialog>
      );
    };

    render(<DialogHost />);

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    fireEvent.change(textarea, { target: { value: 'D' } });

    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe('D');
  });
});
