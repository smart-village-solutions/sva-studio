import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PrivacyDialogs } from './-account-privacy-dialogs';

const createNoteDialogState = () => ({
  open: false,
  note: '',
  onClose: vi.fn(),
  onNoteChange: vi.fn(),
  onSubmit: vi.fn(),
});

describe('PrivacyDialogs', () => {
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
});
