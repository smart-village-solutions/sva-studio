import { describe, expect, it } from 'vitest';

import {
  compareProjectionRows,
  type ProjectionRow,
} from './iam-content-list-projection-model.server.js';

describe('content list projection model', () => {
  it('sorts supported projection fields with nulls last and an ascending id tie-breaker', () => {
    const row = (
      id: string,
      overrides: Partial<
        Pick<ProjectionRow, 'title' | 'created_at' | 'updated_at' | 'published_at'>
      > = {}
    ) => ({
      id,
      title: 'Gleich',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      published_at: null,
      ...overrides,
    });

    expect(
      [
        row('b', { published_at: null }),
        row('c', { published_at: '2026-02-01T00:00:00.000Z' }),
        row('a', { published_at: '2026-02-01T00:00:00.000Z' }),
      ]
        .sort((left, right) => compareProjectionRows(left, right, 'publishedAt', 'desc'))
        .map(({ id }) => id)
    ).toEqual(['a', 'c', 'b']);
    expect(
      [row('b'), row('a')]
        .sort((left, right) => compareProjectionRows(left, right, 'title', 'desc'))
        .map(({ id }) => id)
    ).toEqual(['a', 'b']);
    expect(compareProjectionRows(row('a'), row('b'), 'publishedAt', 'desc')).toBeLessThan(0);
    expect(compareProjectionRows(row('b'), row('a'), 'publishedAt', 'desc')).toBeGreaterThan(0);
  });
});
