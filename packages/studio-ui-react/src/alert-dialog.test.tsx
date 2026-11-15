import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog.js';

afterEach(cleanup);

const renderAlertDialog = (onOpenChange = vi.fn()) =>
  render(
    <AlertDialog onOpenChange={onOpenChange}>
      <AlertDialogTrigger>Eintrag löschen</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
          <AlertDialogDescription>Der Eintrag wird endgültig entfernt.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction>Löschen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

describe('AlertDialog', () => {
  it('names and describes the alert dialog and focuses the safe cancel action first', async () => {
    renderAlertDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag löschen' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Eintrag löschen?',
      description: 'Der Eintrag wird endgültig entfernt.',
    });

    expect(dialog).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }))
    );
  });

  it('keeps Tab focus inside the dialog', async () => {
    renderAlertDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag löschen' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Eintrag löschen?' });
    const cancel = screen.getByRole('button', { name: 'Abbrechen' });
    const action = screen.getByRole('button', { name: 'Löschen' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    action.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(action);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const onOpenChange = vi.fn();
    renderAlertDialog(onOpenChange);
    const trigger = screen.getByRole('button', { name: 'Eintrag löschen' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
