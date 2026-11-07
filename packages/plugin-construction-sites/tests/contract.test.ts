import { describe, expect, it } from 'vitest';
import {
  constructionSiteInputSchema,
  constructionSiteTemporalState,
  createConstructionSiteDefaults,
} from '../src/contract.js';

const valid = () => ({ ...createConstructionSiteDefaults('2026-11-01'), title: 'Brückenbau' });
describe('Baustellenvertrag', () => {
  it('requires title and a complete primary calendar range', () => {
    expect(
      constructionSiteInputSchema.safeParse(createConstructionSiteDefaults('2026-11-01')).success
    ).toBe(false);
    expect(constructionSiteInputSchema.safeParse(valid()).success).toBe(true);
    expect(constructionSiteInputSchema.safeParse({ ...valid(), dates: [] }).success).toBe(false);
    expect(
      constructionSiteInputSchema.safeParse({
        ...valid(),
        dates: [{ dateStart: '2026-02-30', dateEnd: '' }],
      }).success
    ).toBe(false);
  });
  it('rejects reversed dates without changing the chosen end', () => {
    const input = { ...valid(), dates: [{ dateStart: '2026-11-02', dateEnd: '2026-11-01' }] };
    expect(constructionSiteInputSchema.safeParse(input).success).toBe(false);
    expect(input.dates[0].dateEnd).toBe('2026-11-01');
  });
  it('accepts a leap day and zero coordinates, rejects partial/out of range coordinates', () => {
    expect(
      constructionSiteInputSchema.safeParse({
        ...valid(),
        dates: [{ dateStart: '2028-02-29', dateEnd: '2028-02-29' }],
        locations: [{ name: '', latitude: 0, longitude: 0 }],
      }).success
    ).toBe(true);
    for (const latitude of [null, 91, Number.NaN])
      expect(
        constructionSiteInputSchema.safeParse({
          ...valid(),
          locations: [{ name: '', latitude, longitude: 0 }],
        }).success
      ).toBe(false);
  });
  it('rejects forged duplicate snapshot indices', () => {
    expect(
      constructionSiteInputSchema.safeParse({
        ...valid(),
        restrictions: [
          { sourceIndex: 0, description: 'Alt' },
          { sourceIndex: 0, description: 'Kopie' },
        ],
      }).success
    ).toBe(false);
  });
  it('requires persistable HTTP media URLs', () => {
    expect(
      constructionSiteInputSchema.safeParse({
        ...valid(),
        mediaContents: [
          {
            contentType: 'image',
            sourceUrl: { url: 'javascript:alert(1)', description: '' },
            copyright: '',
            captionText: '',
          },
        ],
      }).success
    ).toBe(false);
  });
  it.each([
    ['2026-10-31', 'planned'],
    ['2026-11-01', 'ongoing'],
    ['2026-11-02', 'ongoing'],
    ['2026-11-03', 'ended'],
  ] as const)('classifies date %s as %s including both boundary days', (today, expected) => {
    expect(
      constructionSiteTemporalState({ dateStart: '2026-11-01', dateEnd: '2026-11-02' }, today)
    ).toBe(expected);
  });
  it('keeps missing or damaged ranges distinct from ended construction sites', () => {
    expect(constructionSiteTemporalState(undefined, '2026-11-01')).toBe('incomplete');
    expect(
      constructionSiteTemporalState(
        { dateStart: '2026-02-30', dateEnd: '2026-03-01' },
        '2026-11-01'
      )
    ).toBe('incomplete');
  });
});

describe('construction site geometry contract', () => {
  const feature = (type: 'LineString' | 'Polygon', points: number[][]) => ({
    version: 1,
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: '8b51428e-832b-49ea-a9f7-537608e344e1',
        properties: {},
        geometry: { type, coordinates: type === 'Polygon' ? [points] : points },
      },
    ],
  });
  const parse = (geometry: unknown) =>
    constructionSiteInputSchema.safeParse({ ...valid(), geometry });
  it('preserves omission versus explicit deletion', () => {
    expect(constructionSiteInputSchema.parse(valid())).not.toHaveProperty('geometry');
    expect(parse(null).success).toBe(true);
  });
  it('rounds positions and keeps coordinates in longitude-latitude order', () => {
    const result = parse(
      feature('LineString', [
        [13.123456789, 52.123456789],
        [14, 53],
      ])
    );
    expect(result.success && result.data.geometry?.features[0]?.geometry.coordinates).toEqual([
      [13.123457, 52.123457],
      [14, 53],
    ]);
  });
  it.each([
    [
      'open ring',
      'Polygon',
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    [
      'self intersection',
      'Polygon',
      [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
        [0, 0],
      ],
    ],
    [
      'zero area',
      'Polygon',
      [
        [0, 0],
        [1, 1],
        [2, 2],
        [0, 0],
      ],
    ],
    [
      'rounded duplicate',
      'LineString',
      [
        [0, 0],
        [0.00000001, 0],
      ],
    ],
    [
      'infinite coordinate',
      'LineString',
      [
        [Infinity, 0],
        [1, 1],
      ],
    ],
    [
      'latitude range',
      'LineString',
      [
        [0, 91],
        [1, 1],
      ],
    ],
  ] as const)('rejects %s', (_name, type, points) => {
    expect(
      parse(
        feature(
          type,
          points.map((p) => [...p])
        )
      ).success
    ).toBe(false);
  });
  it('canonicalizes clockwise rings without mutating the input', () => {
    const input = feature('Polygon', [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ]);
    const before = JSON.stringify(input);
    const result = parse(input);
    expect(result.success && result.data.geometry?.features[0]?.geometry.coordinates).toEqual([
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    { points: [] },
    { points: [[0, 0]] },
    {
      points: [
        [0, 0],
        [1, 1],
      ],
    },
  ])('rejects short polygon rings without throwing', ({ points }) => {
    expect(parse(feature('Polygon', points)).success).toBe(false);
  });
  it('rejects non-v4 IDs because the map adapter requires UUID4', () => {
    const value = feature('LineString', [
      [0, 0],
      [1, 1],
    ]);
    value.features[0]!.id = '0194a8e9-0ab4-7a12-8e89-123456789abc';
    expect(parse(value).success).toBe(false);
  });
  it('rejects editor metadata, foreign versions, holes, duplicate IDs and oversized input', () => {
    const shape = feature('LineString', [
      [0, 0],
      [1, 1],
    ]);
    expect(parse({ ...shape, version: 2 }).success).toBe(false);
    expect(parse({ ...shape, features: [...shape.features, ...shape.features] }).success).toBe(
      false
    );
    expect(
      parse(
        feature(
          'LineString',
          Array.from({ length: 501 }, (_, i) => [i / 100, 0])
        )
      ).success
    ).toBe(false);
    expect(
      parse({
        ...shape,
        features: shape.features.map((f) => ({ ...f, properties: { mode: 'linestring' } })),
      }).success
    ).toBe(false);
    const poly = feature('Polygon', [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
    expect(
      parse({
        ...poly,
        features: poly.features.map((f) => ({
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: [...f.geometry.coordinates, ...f.geometry.coordinates],
          },
        })),
      }).success
    ).toBe(false);
  });
});
