import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsCustomRecurrenceDeleteDialog } from '../src/waste-management.settings-custom-recurrence-delete-dialog.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({
    children,
    type = 'button',
    onClick,
  }: {
    readonly children: React.ReactNode;
    readonly type?: 'button' | 'submit';
    readonly onClick?: () => void;
  }) => (
    <button type={type} onClick={onClick}>
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
  Select: ({ id, value, onChange, children }: React.ComponentProps<'select'>) => (
    <select id={id} value={value} onChange={onChange}>
      {children}
    </select>
  ),
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {children}
    </label>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('WasteSettingsCustomRecurrenceDeleteDialog', () => {
  it('syncs the fallback selection when the target preset changes while the dialog stays open', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <WasteSettingsCustomRecurrenceDeleteDialog
        open
        preset={{ id: 'preset-a', name: 'A', description: '', intervalDays: 10 }}
        availableFallbacks={[{ id: 'preset-b', name: 'B', description: '', intervalDays: 14 }]}
        initialFallback={{ kind: 'preset', value: 'preset-b' }}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    expect(
      (screen.getByLabelText('settings.fields.customRecurrenceFallback') as HTMLSelectElement).value
    ).toBe('preset:preset-b');

    rerender(
      <WasteSettingsCustomRecurrenceDeleteDialog
        open
        preset={{ id: 'preset-c', name: 'C', description: '', intervalDays: 21 }}
        availableFallbacks={[{ id: 'preset-d', name: 'D', description: '', intervalDays: 28 }]}
        initialFallback={{ kind: 'preset', value: 'preset-d' }}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    expect(
      (screen.getByLabelText('settings.fields.customRecurrenceFallback') as HTMLSelectElement).value
    ).toBe('preset:preset-d');

    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.deleteCustomRecurrence' }));

    expect(onConfirm).toHaveBeenCalledWith({ kind: 'preset', value: 'preset-d' });
  });
});
