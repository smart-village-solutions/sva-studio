import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CoverageResults } from '../src/waste-management.location-fraction-coverage-check.parts.js';
import { FractionRowActions } from '../src/waste-management.master-data-fraction-row-actions.js';
import { WasteSchedulingRowActions } from '../src/waste-management.scheduling-row-actions.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href="/plugins/waste-management" {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

describe('Waste navigation actions', () => {
  it('renders fraction editing as a link while delete remains a button', () => {
    render(
      <FractionRowActions
        fraction={{ id: 'paper' } as never}
        search={{ tab: 'fractions' } as never}
        onOpenEditFraction={vi.fn()}
        onRequestDeleteFraction={vi.fn()}
      />
    );

    expect(
      screen.getByRole('link', { name: 'masterData.fractions.actions.edit' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'masterData.fractions.actions.delete' })
    ).toBeTruthy();
  });

  it('renders scheduling editing as a link while delete remains a button', () => {
    render(
      <WasteSchedulingRowActions
        row={{ kind: 'holiday', id: 'holiday-1', canDelete: true } as never}
        search={{ tab: 'scheduling' } as never}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onRequestDeleteRows={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'scheduling.holidayRules.editAction' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'scheduling.actions.delete' })).toBeTruthy();
  });

  it('renders coverage issue editing as a link while bulk assignment remains a button', () => {
    const location = { id: 'location-1' } as never;
    render(
      <CoverageResults
        result={{
          checkedLocationCount: 1,
          issues: [{ kind: 'missing', locationId: 'location-1' }],
        }}
        locationsById={new Map([['location-1', location]])}
        search={{ tab: 'locations' } as never}
        onAssign={vi.fn()}
        onEdit={vi.fn()}
        getLocationLabel={() => 'Ort Nord'}
      />
    );

    expect(
      screen.getByRole('link', { name: 'masterData.locationsWorkspace.coverage.edit' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'masterData.locationsWorkspace.coverage.selectAndAssign',
      })
    ).toBeTruthy();
  });
});
