import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrivacyDialogs } from './-account-privacy-dialogs';

const createNoteDialogState = () => ({
  open: false,
  note: '',
  onClose: vi.fn(),
  onNoteChange: vi.fn(),
  onSubmit: vi.fn(),
});

describe('PrivacyDialogs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses stable ids for request note fields instead of translated titles', () => {
    render(
      <PrivacyDialogs
        accessDialog={{ ...createNoteDialogState(), open: true }}
        deletionDialog={createNoteDialogState()}
        exportDialog={{
          open: false,
          format: 'json',
          onClose: vi.fn(),
          onFormatChange: vi.fn(),
          onSubmit: vi.fn(),
        }}
        isSubmitting={false}
        objectionDialog={createNoteDialogState()}
        permissionChangeDialog={createNoteDialogState()}
        restrictionDialog={createNoteDialogState()}
      />
    );

    const noteField = screen.getByLabelText('Zusätzliche Hinweise');
    expect(noteField.getAttribute('id')).toBe('privacy-access-request-note');
  });

  it('shows a dismissible fax easter egg over the access dialog and ends with a failed transmission', async () => {
    vi.useFakeTimers();

    render(
      <PrivacyDialogs
        accessDialog={{ ...createNoteDialogState(), open: true }}
        deletionDialog={createNoteDialogState()}
        exportDialog={{
          open: false,
          format: 'json',
          onClose: vi.fn(),
          onFormatChange: vi.fn(),
          onSubmit: vi.fn(),
        }}
        isSubmitting={false}
        objectionDialog={createNoteDialogState()}
        permissionChangeDialog={createNoteDialogState()}
        restrictionDialog={createNoteDialogState()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Als Fax versenden' }));

    expect(screen.getByRole('dialog', { name: 'Als Fax versenden' })).toBeTruthy();
    expect(screen.getByText(/% von faxversand\.exe abgeschlossen$/)).toBeTruthy();
    expect(screen.getByText('Speichern:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Öffnen' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Ordner öffnen' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByText('Papier wird eingelegt ...')).toBeTruthy();
    const progressBar = screen.getByRole('progressbar', { name: 'Faxversand-Fortschritt' });
    const firstFilledSegment = progressBar.querySelector('[data-progress-filled="true"]');
    expect(firstFilledSegment?.className).toContain('bg-[#0606a7]');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(screen.getByText('Toner wird geschüttelt ...')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(screen.getByText('Empfangsgerät piept beleidigt ...')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });
    expect(screen.getByText('Fehlgeschlagen: Gegenstelle hat Feierabend.')).toBeTruthy();
    expect(progressBar.querySelector('[data-progress-filled="true"]')?.className).toContain('bg-[#b91c1c]');

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(screen.queryByRole('dialog', { name: 'Als Fax versenden' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Auskunft anfordern' })).toBeTruthy();
  });
});
