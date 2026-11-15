import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox.js';

afterEach(cleanup);

describe('Checkbox', () => {
  const renderSelectAll = (props: { checked: boolean; indeterminate: boolean }) => (
    <label>
      <Checkbox {...props} onChange={vi.fn()} />
      Alle Zeilen auswählen
    </label>
  );

  it('keeps the native mixed state in sync with the indeterminate prop across rerenders', () => {
    const { rerender } = render(renderSelectAll({ checked: false, indeterminate: true }));
    const control = screen.getByRole('checkbox', {
      name: 'Alle Zeilen auswählen',
    }) as HTMLInputElement;

    expect(control.type).toBe('checkbox');
    expect(control.indeterminate).toBe(true);

    rerender(renderSelectAll({ checked: true, indeterminate: false }));
    expect(control.indeterminate).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Alle Zeilen auswählen', checked: true })).toBe(
      control
    );

    rerender(renderSelectAll({ checked: false, indeterminate: true }));
    expect(control.indeterminate).toBe(true);
    expect(control.checked).toBe(false);
  });
});
