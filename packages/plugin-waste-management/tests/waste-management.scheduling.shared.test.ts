import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  combineSchedulingTableRows,
  filterGlobalDateShifts,
  filterTourDateShifts,
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
  toCreateGlobalDateShiftInput,
  toCreateTourDateShiftInput,
  toUpdateGlobalDateShiftInput,
  toUpdateTourDateShiftInput,
} from '../src/waste-management.scheduling.shared.js';

describe('waste-management scheduling shared helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates deterministic default forms with generated ids', () => {
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce('tour-shift-id')
      .mockReturnValueOnce('global-shift-id');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createDefaultTourDateShiftForm()).toEqual({
      id: 'tour-shift-id',
      tourId: '',
      originalDate: '',
      actualDate: '',
      hasYear: true,
      reasonType: '',
      reasonKey: '',
      followUpMode: '',
      description: '',
    });
    expect(createDefaultGlobalDateShiftForm()).toEqual({
      id: 'global-shift-id',
      originalDate: '',
      actualDate: '',
      hasYear: true,
      reasonType: '',
      reasonKey: '',
      description: '',
      tourIds: [],
    });
  });

  it('maps records into form state and normalizes missing optional fields', () => {
    expect(
      mapTourDateShiftToForm({
        id: 'tour-shift-1',
        tourId: 'tour-1',
        originalDate: '2026-05-01',
        actualDate: '2026-05-02',
        hasYear: true,
        reasonType: undefined,
        reasonKey: undefined,
        followUpMode: undefined,
        description: undefined,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      })
    ).toEqual({
      id: 'tour-shift-1',
      tourId: 'tour-1',
      originalDate: '2026-05-01',
      actualDate: '2026-05-02',
      hasYear: true,
      reasonType: '',
      reasonKey: '',
      followUpMode: '',
      description: '',
    });

    expect(
      mapGlobalDateShiftToForm({
        id: 'global-shift-1',
        originalDate: '2026-12-24',
        actualDate: '2026-12-25',
        hasYear: false,
        reasonType: undefined,
        reasonKey: undefined,
        description: undefined,
        tourIds: undefined,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      })
    ).toEqual({
      id: 'global-shift-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-25',
      hasYear: false,
      reasonType: '',
      reasonKey: '',
      description: '',
      tourIds: [],
    });
  });

  it('builds create and update payloads with trimmed optional values', () => {
    const tourForm = {
      id: 'tour-shift-2',
      tourId: 'tour-2',
      originalDate: '2026-05-03',
      actualDate: '2026-05-04',
      hasYear: false,
      reasonType: '',
      reasonKey: '  ',
      followUpMode: '',
      description: '  ',
    } as const;
    expect(toCreateTourDateShiftInput(tourForm)).toEqual({
      id: 'tour-shift-2',
      tourId: 'tour-2',
      originalDate: '2026-05-03',
      actualDate: '2026-05-04',
      hasYear: false,
      reasonType: undefined,
      reasonKey: undefined,
      followUpMode: undefined,
      description: undefined,
    });
    expect(toUpdateTourDateShiftInput(tourForm)).toEqual({
      tourId: 'tour-2',
      originalDate: '2026-05-03',
      actualDate: '2026-05-04',
      hasYear: false,
      reasonType: undefined,
      reasonKey: undefined,
      followUpMode: undefined,
      description: undefined,
    });

    const globalForm = {
      id: 'global-shift-2',
      originalDate: '2026-12-31',
      actualDate: '2027-01-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: ' nyd ',
      description: '  Verschoben  ',
      tourIds: [],
    } as const;
    expect(toCreateGlobalDateShiftInput(globalForm)).toEqual({
      id: 'global-shift-2',
      originalDate: '2026-12-31',
      actualDate: '2027-01-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'nyd',
      description: 'Verschoben',
      tourIds: undefined,
    });
    expect(
      toUpdateGlobalDateShiftInput({
        ...globalForm,
        tourIds: ['tour-1', 'tour-2'],
      })
    ).toEqual({
      originalDate: '2026-12-31',
      actualDate: '2027-01-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'nyd',
      description: 'Verschoben',
      tourIds: ['tour-1', 'tour-2'],
    });
  });

  it('filters tour date shifts by context, tour id and free text', () => {
    const shifts = [
      {
        id: 'tour-shift-a',
        tourId: 'tour-1',
        originalDate: '2026-05-01',
        actualDate: '2026-05-02',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'BridgeDay',
        followUpMode: 'skip',
        description: 'Brueckentag',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'tour-shift-b',
        tourId: 'tour-2',
        originalDate: '2026-06-01',
        actualDate: '2026-06-03',
        hasYear: true,
        reasonType: 'weather',
        reasonKey: undefined,
        followUpMode: undefined,
        description: undefined,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ] as const;

    expect(
      filterTourDateShifts(shifts, {
        tab: 'scheduling',
        q: '',
        shiftContext: 'global',
        tourId: '',
        settingsTab: 'source',
      })
    ).toEqual([]);
    expect(
      filterTourDateShifts(shifts, {
        tab: 'scheduling',
        q: '',
        shiftContext: 'tour',
        tourId: 'tour-2',
        settingsTab: 'source',
      })
    ).toEqual([shifts[1]]);
    expect(
      filterTourDateShifts(shifts, {
        tab: 'scheduling',
        q: 'bridge',
        shiftContext: 'all',
        tourId: '',
        settingsTab: 'source',
      })
    ).toEqual([shifts[0]]);
    expect(
      filterTourDateShifts(shifts, {
        tab: 'scheduling',
        q: '2026-06-03',
        shiftContext: 'all',
        tourId: '',
        settingsTab: 'source',
      })
    ).toEqual([shifts[1]]);
  });

  it('filters global date shifts by context, linked tours and free text', () => {
    const shifts = [
      {
        id: 'global-shift-a',
        originalDate: '2026-12-24',
        actualDate: '2026-12-27',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'XMAS',
        description: 'Weihnachtsverschiebung',
        tourIds: ['tour-1'],
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'global-shift-b',
        originalDate: '2027-01-01',
        actualDate: '2027-01-02',
        hasYear: true,
        reasonType: undefined,
        reasonKey: undefined,
        description: undefined,
        tourIds: undefined,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ] as const;

    expect(
      filterGlobalDateShifts(shifts, {
        tab: 'scheduling',
        q: '',
        shiftContext: 'tour',
        tourId: '',
        settingsTab: 'source',
      })
    ).toEqual([]);
    expect(
      filterGlobalDateShifts(shifts, {
        tab: 'scheduling',
        q: '',
        shiftContext: 'global',
        tourId: 'tour-1',
        settingsTab: 'source',
      })
    ).toEqual([shifts[0]]);
    expect(
      filterGlobalDateShifts(shifts, {
        tab: 'scheduling',
        q: 'xmas',
        shiftContext: 'all',
        tourId: '',
        settingsTab: 'source',
      })
    ).toEqual([shifts[0]]);
    expect(
      filterGlobalDateShifts(shifts, {
        tab: 'scheduling',
        q: '2027-01-02',
        shiftContext: 'all',
        tourId: '',
        settingsTab: 'source',
      })
    ).toEqual([shifts[1]]);
  });

  it('combines global and tour shifts into a date-sorted table model with resolved tour labels', () => {
    const rows = combineSchedulingTableRows({
      globalDateShifts: [
        {
          id: 'global-1',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          reasonType: 'holiday',
          reasonKey: 'new-year',
          description: 'Neujahr',
          tourIds: ['tour-2', 'tour-1'],
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [
        {
          id: 'tour-shift-1',
          tourId: 'tour-1',
          originalDate: '2026-01-01',
          actualDate: '2026-01-03',
          hasYear: true,
          reasonType: 'weather',
          reasonKey: 'snow',
          description: 'Schnee',
          followUpMode: 'skip-once',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      availableTours: [
        { id: 'tour-1', name: 'Bio Süd' },
        { id: 'tour-2', name: 'Rest Nord' },
      ] as never,
      t: (key: string) => key,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'global',
        id: 'global-1',
        contextLabel: 'Rest Nord, Bio Süd',
      }),
      expect.objectContaining({
        kind: 'tour',
        id: 'tour-shift-1',
        contextLabel: 'Bio Süd',
      }),
    ]);
  });
});
