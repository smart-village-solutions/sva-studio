import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursToolbarActions } from '../src/waste-management.tours.toolbar.actions.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

const createProps = (selectedCount: number) => ({
  selectedCount,
  hiddenSelectedCount: 0,
  filteredCount: selectedCount,
  allFilteredSelected: selectedCount > 0,
  someFilteredSelected: false,
  filterDialogOpen: false,
  hasActiveFilters: false,
  onOpenBulkDelete: vi.fn(),
  onOpenBulkValidity: vi.fn(),
  onOpenBulkStatus: vi.fn(),
  onToggleSelectAllFiltered: vi.fn(),
  onClearSelection: vi.fn(),
  onOpenFilterDialog: vi.fn(),
  onResetFilters: vi.fn(),
});

describe('WasteToursToolbarActions', () => {
  afterEach(() => cleanup());

  it('disables only the validity action when more than 100 tours are selected', () => {
    render(<WasteToursToolbarActions {...createProps(101)} />);

    expect(
      (screen.getByRole('button', { name: 'tours.bulkValidityDialog.title' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'tours.bulkStatusDialog.open' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('tours.bulkValidityDialog.tooMany:100');
  });
});
