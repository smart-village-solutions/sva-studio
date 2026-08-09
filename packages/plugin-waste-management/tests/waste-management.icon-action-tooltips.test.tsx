import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FractionRowActions } from '../src/waste-management.master-data-fraction-row-actions.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

afterEach(() => cleanup());

describe('Waste icon action tooltips', () => {
  it('explains icon-only actions on hover and keyboard focus', () => {
    render(
      <FractionRowActions
        fraction={{ id: 'paper' } as never}
        onOpenEditFraction={vi.fn()}
        onRequestDeleteFraction={vi.fn()}
      />
    );

    const editButton = screen.getByRole('button', {
      name: 'masterData.fractions.actions.edit',
    });
    fireEvent.mouseEnter(editButton);
    expect(screen.getByRole('tooltip').textContent).toBe(
      'masterData.fractions.actions.edit'
    );

    fireEvent.mouseLeave(editButton);
    expect(screen.queryByRole('tooltip')).toBeNull();

    const deleteButton = screen.getByRole('button', {
      name: 'masterData.fractions.actions.delete',
    });
    fireEvent.focus(deleteButton);
    expect(screen.getByRole('tooltip').textContent).toBe(
      'masterData.fractions.actions.delete'
    );
  });
});
