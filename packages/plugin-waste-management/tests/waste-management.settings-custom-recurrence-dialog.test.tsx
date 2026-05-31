import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsCustomRecurrenceDialog } from '../src/waste-management.settings-custom-recurrence-dialog.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({
    children,
    type = 'button',
    onClick,
    disabled,
  }: {
    readonly children: React.ReactNode;
    readonly type?: 'button' | 'submit';
    readonly onClick?: () => void;
    readonly disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Dialog: ({
    children,
    open,
  }: {
    readonly children: React.ReactNode;
    readonly open: boolean;
    readonly onOpenChange?: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Input: ({ id, value, onChange, type = 'text', min }: React.ComponentProps<'input'>) => (
    <input id={id} value={value} onChange={onChange} type={type} min={min} />
  ),
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: string;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Textarea: ({ id, value, onChange }: React.ComponentProps<'textarea'>) => (
    <textarea id={id} value={value} onChange={onChange} />
  ),
}));

afterEach(() => {
  cleanup();
});

describe('WasteSettingsCustomRecurrenceDialog', () => {
  it('resets the create draft when the dialog is reopened', () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <WasteSettingsCustomRecurrenceDialog
        open
        mode="create"
        value={null}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText('settings.fields.customRecurrenceName'), {
      target: { value: 'Ferien 10 Tage' },
    });
    fireEvent.change(screen.getByLabelText('settings.fields.customRecurrenceIntervalDays'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('settings.fields.customRecurrenceDescription'), {
      target: { value: 'Sommerturnus' },
    });

    rerender(
      <WasteSettingsCustomRecurrenceDialog
        open={false}
        mode="create"
        value={null}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    rerender(
      <WasteSettingsCustomRecurrenceDialog
        open
        mode="create"
        value={null}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    expect((screen.getByLabelText('settings.fields.customRecurrenceName') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('settings.fields.customRecurrenceIntervalDays') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('settings.fields.customRecurrenceDescription') as HTMLTextAreaElement).value).toBe('');
  });
});
