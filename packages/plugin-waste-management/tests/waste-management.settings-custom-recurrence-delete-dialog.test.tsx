import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSettingsCustomRecurrenceDeleteDialog } from '../src/waste-management.settings-custom-recurrence-delete-dialog.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioDestructiveActionDialog: ({
    children,
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    readonly children: React.ReactNode;
    readonly open: boolean;
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly confirmLabel: React.ReactNode;
    readonly cancelLabel: React.ReactNode;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div role="alertdialog">
        <div>{title}</div>
        <div>{description}</div>
        {children}
        <button onClick={onCancel}>{cancelLabel}</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null,
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

    fireEvent.click(
      screen.getByRole('button', { name: 'settings.actions.deleteCustomRecurrence' })
    );

    expect(onConfirm).toHaveBeenCalledWith({ kind: 'preset', value: 'preset-d' });
  });

  it('uses the shared destructive dialog and resets the fallback on cancel', () => {
    const onOpenChange = vi.fn();
    render(
      <WasteSettingsCustomRecurrenceDeleteDialog
        open
        preset={{ id: 'preset-a', name: 'A', description: '', intervalDays: 10 }}
        availableFallbacks={[{ id: 'preset-b', name: 'B', description: '', intervalDays: 14 }]}
        initialFallback={{ kind: 'preset', value: 'preset-b' }}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('settings.fields.customRecurrenceFallback'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
