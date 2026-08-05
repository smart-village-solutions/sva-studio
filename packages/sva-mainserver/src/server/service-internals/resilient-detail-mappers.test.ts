import { describe, expect, it } from 'vitest';

import { mapEventItemDetail } from './event-mappers.js';
import { mapPoiItemDetail } from './poi-mappers.js';

describe('resilient Mainserver detail mappers', () => {
  it('keeps valid event fields and list entries when optional values deviate', () => {
    const result = mapEventItemDetail({
      id: 'event-1',
      title: 42,
      dates: [
        { id: 'date-1', dateStart: '2026-08-05' },
        { id: 'date-2', dateStart: { invalid: true } },
      ],
      tagList: ['stadtfest', 7],
    } as never);

    expect(result.data).toMatchObject({
      id: 'event-1',
      title: '',
      dates: [{ id: 'date-1', dateStart: '2026-08-05' }],
      tags: ['stadtfest'],
    });
    expect(result.deviations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: 'title', fieldGroup: 'title', handling: 'omitted' }),
        expect.objectContaining({ fieldPath: 'dates[]', fieldGroup: 'dates' }),
        expect.objectContaining({ fieldPath: 'tags[]', fieldGroup: 'tags' }),
      ])
    );
  });

  it('keeps valid POI list entries and rejects an invalid stable identity', () => {
    const result = mapPoiItemDetail({
      id: 'poi-1',
      name: 'Rathaus',
      categories: [{ id: 'category-1', name: 'Verwaltung' }, { id: 4 }],
    } as never);

    expect(result.data).toMatchObject({
      id: 'poi-1',
      name: 'Rathaus',
      categories: [{ id: 'category-1', name: 'Verwaltung' }],
    });
    expect(result.deviations).toContainEqual(
      expect.objectContaining({ fieldPath: 'categories[]', fieldGroup: 'categories' })
    );
    expect(() => mapPoiItemDetail({ id: '' } as never)).toThrow('Ungültige POI-Antwort');
  });
});
