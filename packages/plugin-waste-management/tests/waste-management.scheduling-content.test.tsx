import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingContent } from '../src/waste-management.scheduling-content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({
    children,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => <span data-testid="badge" data-variant={variant ?? 'default'}>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('WasteSchedulingContent', () => {
  it('renders global and tour shifts as tables with headers and row actions', () => {
    const onEditGlobalShiftDialog = vi.fn();
    const onEditTourShiftDialog = vi.fn();

    render(
      <WasteSchedulingContent
        message={{ tone: 'info', text: 'shift message' } as never}
        globalDateShifts={[
          {
            id: 'global-1',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            description: 'Neujahr',
            hasYear: true,
            reasonType: 'holiday',
            reasonKey: 'holiday.new-year',
            tourIds: ['tour-1', 'tour-2'],
          },
        ] as never}
        tourDateShifts={[
          {
            id: 'tour-shift-1',
            tourId: 'tour-1',
            originalDate: '2026-02-01',
            actualDate: '2026-02-03',
            description: 'Baustelle',
            hasYear: false,
            reasonType: 'operational-disruption',
            reasonKey: 'ops.roadwork',
            followUpMode: 'propagate-series',
          },
        ] as never}
        onOpenCreateGlobalShiftDialog={vi.fn()}
        onOpenCreateTourShiftDialog={vi.fn()}
        onEditGlobalShiftDialog={onEditGlobalShiftDialog}
        onEditTourShiftDialog={onEditTourShiftDialog}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('shift message')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'scheduling.global.table.ariaLabel' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'scheduling.tour.table.ariaLabel' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'scheduling.global.table.originalDate' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'scheduling.global.table.actualDate' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'scheduling.global.table.reason' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'scheduling.tour.table.tourId' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'scheduling.tour.table.followUpMode' })).toBeTruthy();
    expect(screen.getByText('2026-01-01')).toBeTruthy();
    expect(screen.getByText('2026-01-02')).toBeTruthy();
    expect(screen.getByText('2026-02-03')).toBeTruthy();
    expect(screen.getByText('Neujahr')).toBeTruthy();
    expect(screen.getByText('Baustelle')).toBeTruthy();
    expect(screen.getByText('scheduling.reasonTypes.holiday')).toBeTruthy();
    expect(screen.getByText('scheduling.followUpModes.propagate-series')).toBeTruthy();
    expect(screen.queryByText('scheduling.meta.globalCount:1')).toBeNull();
    expect(screen.queryByText('scheduling.meta.tourCount:1')).toBeNull();
    expect(screen.queryAllByTestId('badge')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.global.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.tour.actions.edit' }));

    expect(onEditGlobalShiftDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 'global-1' }));
    expect(onEditTourShiftDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 'tour-shift-1' }));
  });
});
