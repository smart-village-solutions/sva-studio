import type {
  WasteCollectionLocationRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { describe, expect, it } from 'vitest';

import { checkLocationFractionCoverage } from '../src/waste-management.location-fraction-coverage.js';

const timestamp = '2026-08-09T10:00:00.000Z';

const location = (id: string, active = true): WasteCollectionLocationRecord => ({
  id,
  cityId: 'city-1',
  active,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const tour = (
  id: string,
  wasteFractionIds: readonly string[],
  firstDate?: string,
  endDate?: string,
  status: WasteTourRecord['status'] = 'published'
): WasteTourRecord => ({
  id,
  name: id,
  wasteFractionIds,
  firstDate,
  endDate,
  status,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const link = (id: string, locationId: string, tourId: string): WasteLocationTourLinkRecord => ({
  id,
  locationId,
  tourId,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const check = (
  locations: readonly WasteCollectionLocationRecord[],
  tours: readonly WasteTourRecord[],
  links: readonly WasteLocationTourLinkRecord[],
  includeDrafts = false
) =>
  checkLocationFractionCoverage({
    locations,
    tours,
    links,
    fractionId: 'paper',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    includeDrafts,
  });

describe('checkLocationFractionCoverage', () => {
  it('does not mistake the first January pickup of a recurring tour for an uncovered period', () => {
    expect(
      check(
        [location('regular')],
        [{ ...tour('paper-2027', ['paper'], '2027-01-07', '2027-12-31'), recurrence: 'biweekly' }],
        [link('link-regular', 'regular', 'paper-2027')]
      )
    ).toEqual([]);
  });

  it('still reports a real later start and a January one-off date as incomplete', () => {
    expect(
      check(
        [location('later'), location('one-off')],
        [
          { ...tour('later-tour', ['paper'], '2027-03-07', '2027-12-31'), recurrence: 'biweekly' },
          {
            ...tour('one-off-tour', ['paper'], '2027-01-07', '2027-12-31'),
            recurrence: 'on-demand',
          },
        ],
        [link('later-link', 'later', 'later-tour'), link('one-off-link', 'one-off', 'one-off-tour')]
      )
    ).toEqual([
      {
        locationId: 'later',
        kind: 'incomplete',
        gaps: [{ startDate: '2027-01-01', endDate: '2027-03-06' }],
      },
      {
        locationId: 'one-off',
        kind: 'incomplete',
        gaps: [{ startDate: '2027-01-01', endDate: '2027-01-06' }],
      },
    ]);
  });

  it('can check next-year draft planning without treating drafts as published', () => {
    const plannedTour = {
      ...tour('draft-2027', ['paper'], '2027-01-07', '2027-12-31', 'draft'),
      recurrence: 'biweekly' as const,
    };
    const plannedLocation = [location('planned')];
    const plannedLink = [link('link-planned', 'planned', plannedTour.id)];
    expect(check(plannedLocation, [plannedTour], plannedLink)).toMatchObject([
      { locationId: 'planned', kind: 'missing' },
    ]);
    expect(check(plannedLocation, [plannedTour], plannedLink, true)).toEqual([]);
    expect(
      check(plannedLocation, [{ ...plannedTour, status: 'archived' }], plannedLink, true)
    ).toMatchObject([{ locationId: 'planned', kind: 'missing' }]);
  });
  it('distinguishes a completely missing assignment from partial date coverage', () => {
    expect(
      check(
        [location('missing'), location('partial')],
        [tour('paper-tour', ['paper'], '2027-01-01', '2027-06-30')],
        [link('link-1', 'partial', 'paper-tour')]
      )
    ).toEqual([
      {
        locationId: 'missing',
        kind: 'missing',
        gaps: [{ startDate: '2027-01-01', endDate: '2027-12-31' }],
      },
      {
        locationId: 'partial',
        kind: 'incomplete',
        gaps: [{ startDate: '2027-07-01', endDate: '2027-12-31' }],
      },
    ]);
  });

  it('combines overlapping and directly adjacent assignments without reporting a gap', () => {
    expect(
      check(
        [location('covered')],
        [
          tour('paper-north', ['paper'], '2027-01-01', '2027-06-30'),
          tour('paper-south', ['paper'], '2027-06-15', '2027-12-31'),
        ],
        [link('link-1', 'covered', 'paper-north'), link('link-2', 'covered', 'paper-south')]
      )
    ).toEqual([]);

    expect(
      check(
        [location('adjacent')],
        [
          tour('paper-north', ['paper'], '2027-01-01', '2027-06-30'),
          tour('paper-south', ['paper'], '2027-07-01', '2027-12-31'),
        ],
        [link('link-3', 'adjacent', 'paper-north'), link('link-4', 'adjacent', 'paper-south')]
      )
    ).toEqual([]);
  });

  it('clips open tour boundaries to the requested period and reports internal gaps', () => {
    expect(
      check(
        [location('open'), location('gap')],
        [
          tour('paper-open', ['paper']),
          tour('paper-spring', ['paper'], undefined, '2027-03-31'),
          tour('paper-autumn', ['paper'], '2027-10-01'),
          tour('bio-tour', ['bio']),
        ],
        [
          link('link-1', 'open', 'paper-open'),
          link('link-2', 'gap', 'paper-spring'),
          link('link-3', 'gap', 'paper-autumn'),
          link('link-4', 'gap', 'bio-tour'),
        ]
      )
    ).toEqual([
      {
        locationId: 'gap',
        kind: 'incomplete',
        gaps: [{ startDate: '2027-04-01', endDate: '2027-09-30' }],
      },
    ]);
  });

  it('checks only active collection locations', () => {
    expect(check([location('inactive', false)], [], [])).toEqual([]);
  });

  it.each(['draft', 'archived'] as const)(
    'does not treat %s tours as fraction coverage',
    (status) => {
      expect(
        check(
          [location(`only-${status}`)],
          [tour(`${status}-paper`, ['paper'], '2027-01-01', '2027-12-31', status)],
          [link(`link-${status}`, `only-${status}`, `${status}-paper`)]
        )
      ).toEqual([
        {
          locationId: `only-${status}`,
          kind: 'missing',
          gaps: [{ startDate: '2027-01-01', endDate: '2027-12-31' }],
        },
      ]);
    }
  );
});
