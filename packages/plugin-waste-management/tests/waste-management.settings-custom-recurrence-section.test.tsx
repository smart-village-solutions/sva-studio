import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsCustomRecurrenceSection } from '../src/waste-management.settings-custom-recurrence-section.js';

const capturedDeleteDialogProps = vi.hoisted(() => ({
  current: null as null | {
    readonly onConfirm: (fallback: { readonly kind: 'preset' | 'default'; readonly value: string } | undefined) => void;
  },
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({
    children,
    type = 'button',
    onClick,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly type?: 'button' | 'submit';
    readonly onClick?: () => void;
    readonly variant?: string;
  }) => (
    <button type={type} data-variant={variant} onClick={onClick}>
      {children}
    </button>
  ),
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
}));

vi.mock('../src/waste-management.settings-custom-recurrence-dialog.js', () => ({
  WasteSettingsCustomRecurrenceDialog: () => null,
}));

vi.mock('../src/waste-management.settings-custom-recurrence-delete-dialog.js', () => ({
  WasteSettingsCustomRecurrenceDeleteDialog: ({
    open,
    onConfirm,
  }: {
    readonly open: boolean;
    readonly onConfirm: (fallback: { readonly kind: 'preset' | 'default'; readonly value: string } | undefined) => void;
  }) => {
    capturedDeleteDialogProps.current = { onConfirm };
    return open ? <button onClick={() => onConfirm(undefined)}>confirm-delete</button> : null;
  },
}));

afterEach(() => {
  cleanup();
  capturedDeleteDialogProps.current = null;
});

describe('WasteSettingsCustomRecurrenceSection', () => {
  it('removes stale fallback references when deleting a preset that another pending deletion points to', () => {
    const onPersist = vi.fn();

    render(
      <WasteSettingsCustomRecurrenceSection
        items={[
          { id: 'preset-a', name: 'A', description: '', intervalDays: 10 },
          { id: 'preset-b', name: 'B', description: '', intervalDays: 14 },
        ]}
        deletedPresetFallbacks={{
          'preset-b': {
            kind: 'preset',
            value: 'preset-a',
          },
        }}
        saving={false}
        onPersist={onPersist}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'settings.actions.deleteCustomRecurrence' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

    expect(onPersist).toHaveBeenCalledWith(
      [{ id: 'preset-b', name: 'B', description: '', intervalDays: 14 }],
      {}
    );
  });
});
