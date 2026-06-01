import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingContent, WasteSchedulingEmptyState } from '../src/waste-management.scheduling-content.js';

const shiftsTableMock = vi.hoisted(() => vi.fn());

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

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

afterEach(() => {
  cleanup();
  shiftsTableMock.mockReset();
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
    const onDeleteSchedulingRows = vi.fn(async () => undefined);
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
        schedulingEntries={[
          {
            id: 'holiday-rule-1',
            entryType: 'holiday-rule',
            kind: 'holiday',
            originalDate: '2026-01-01',
            actualDate: undefined,
            contextLabel: 'Neujahr',
            sortLabel: 'Neujahr',
            canDelete: false,
            rule: holidayRule,
          },
          {
            id: 'global-1',
            entryType: 'global-shift',
            kind: 'global',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            contextLabel: 'Restmüll Nord',
            sortLabel: 'Restmüll Nord',
            canDelete: true,
            shift: globalShift,
          },
          {
            id: 'tour-shift-1',
            entryType: 'tour-shift',
            kind: 'tour',
            originalDate: '2026-02-01',
            actualDate: '2026-02-03',
            contextLabel: 'Restmüll Nord',
            sortLabel: 'Restmüll Nord',
            canDelete: true,
            shift: tourShift,
          },
        ] as never}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={onDeleteSchedulingRows}
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
    expect(shiftsTableMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        entries: [
          expect.objectContaining({ kind: 'holiday', id: 'holiday-rule-1' }),
          expect.objectContaining({ kind: 'global', id: 'global-1' }),
          expect.objectContaining({ kind: 'tour', id: 'tour-shift-1' }),
        ],
        onDeleteSchedulingRows,
        page: 2,
        pageSize: 25,
      })
    );
  });

  it('renders the unified create action in the empty state', () => {
    const onOpenCreateShiftDialog = vi.fn();

    render(<WasteSchedulingEmptyState onOpenCreateShiftDialog={onOpenCreateShiftDialog} />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.actions.openCreate' }));
    expect(onOpenCreateShiftDialog).toHaveBeenCalledTimes(1);
  });
});
