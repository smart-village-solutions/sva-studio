import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingContent, WasteSchedulingEmptyState } from '../src/waste-management.scheduling-content.js';

const shiftsTableMock = vi.hoisted(() => vi.fn());
const holidayRulesListMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
}));

vi.mock('../src/waste-management.scheduling-shifts-table.js', () => ({
  WasteSchedulingShiftsTable: (props: Record<string, unknown>) => {
    shiftsTableMock(props);
    return <div data-testid="shifts-table" />;
  },
}));

vi.mock('../src/waste-management.holiday-rules-list.js', () => ({
  WasteHolidayRulesList: (props: Record<string, unknown>) => {
    holidayRulesListMock(props);
    return (
      <div data-testid="holiday-rules-list">
        <button type="button" onClick={() => (props.onRunSync as () => void)()}>
          run-holiday-sync
        </button>
      </div>
    );
  },
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

afterEach(() => {
  cleanup();
  shiftsTableMock.mockReset();
  holidayRulesListMock.mockReset();
});

describe('WasteSchedulingContent', () => {
  it('passes the scheduling state into the combined shifts table', () => {
    const globalShift = {
      id: 'global-1',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      description: 'Neujahr',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'holiday.new-year',
      tourIds: ['tour-1'],
    };
    const tourShift = {
      id: 'tour-shift-1',
      tourId: 'tour-1',
      originalDate: '2026-02-01',
      actualDate: '2026-02-03',
      description: 'Baustelle',
      hasYear: false,
      reasonType: 'operational-disruption',
      reasonKey: 'ops.roadwork',
      followUpMode: 'propagate-series',
    };
    const availableTours = [{ id: 'tour-1', name: 'Restmüll Nord' }];
    const onDeleteSchedulingRows = vi.fn(async () => undefined);
    const onRunHolidaySync = vi.fn(async () => undefined);
    const holidayRule = {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'draft',
      conflictStatus: 'none',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    };

    render(
      <WasteSchedulingContent
        message={{ tone: 'info', text: 'shift message' } as never}
        globalDateShifts={[globalShift] as never}
        tourDateShifts={[tourShift] as never}
        holidayRules={[holidayRule] as never}
        availableTours={availableTours as never}
        onOpenCreateShiftDialog={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={onDeleteSchedulingRows}
        onRunHolidaySync={onRunHolidaySync}
        saving={false}
        page={2}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('shift message')).toBeTruthy();
    expect(screen.getByTestId('shifts-table')).toBeTruthy();
    expect(screen.getByTestId('holiday-rules-list')).toBeTruthy();
    expect(shiftsTableMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        globalDateShifts: [globalShift],
        tourDateShifts: [tourShift],
        availableTours,
        onDeleteSchedulingRows,
        page: 2,
        pageSize: 25,
      })
    );
    expect(holidayRulesListMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        rules: [holidayRule],
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'run-holiday-sync' }));
    expect(onRunHolidaySync).toHaveBeenCalledTimes(1);
  });

  it('renders the unified create action in the empty state', () => {
    const onOpenCreateShiftDialog = vi.fn();

    render(<WasteSchedulingEmptyState onOpenCreateShiftDialog={onOpenCreateShiftDialog} />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.actions.openCreate' }));
    expect(onOpenCreateShiftDialog).toHaveBeenCalledTimes(1);
  });
});
