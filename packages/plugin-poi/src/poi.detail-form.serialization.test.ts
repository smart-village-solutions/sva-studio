import { describe, expect, it } from 'vitest';

import { createDefaultPoiDetailFormValues } from './poi.detail-form.defaults.js';
import { mapPoiDetailFormValuesToInput } from './poi.detail-form.serialization.js';
import type { PoiDetailFormValues } from './poi.detail-form.types.js';

const serializeRows = (
  content: Partial<
    Pick<PoiDetailFormValues['content'], 'openingHours' | 'prices'>
  >
) => {
  const defaults = createDefaultPoiDetailFormValues();

  return mapPoiDetailFormValuesToInput(
    {
      ...defaults,
      content: { ...defaults.content, ...content },
    },
    {}
  );
};

describe('POI detail form row serialization', () => {
  it('serializes substantive opening hours with normalized weekdays and compacted values', () => {
    const input = serializeRows({
      openingHours: [
        {
          weekday: ' Dienstag ',
          dateFrom: ' 2026-07-01 ',
          dateTo: ' ',
          timeFrom: ' 09:00 ',
          timeTo: ' 17:00 ',
          sortNumber: '0',
          open: false,
          useYear: false,
          description: ' Sommer ',
        },
        { open: true },
      ],
    });

    expect(input.openingHours).toEqual([
      {
        weekday: 'TU',
        dateFrom: '2026-07-01',
        timeFrom: '09:00',
        timeTo: '17:00',
        sortNumber: 0,
        open: false,
        useYear: false,
        description: 'Sommer',
      },
    ]);
  });

  it('serializes price numbers, retains invalid amounts for validation, and drops boolean-only rows', () => {
    const input = serializeRows({
      prices: [
        {
          name: ' Eintritt ',
          amount: ' 12.50 ',
          groupPrice: false,
          ageFrom: '0',
          ageTo: '17',
          minAdultCount: ' ',
          maxAdultCount: '2',
          minChildrenCount: 'invalid',
          maxChildrenCount: '4',
          description: ' Regulär ',
          category: ' Erwachsene ',
        },
        { amount: 'invalid' },
        { groupPrice: true },
      ],
    });

    expect(input.priceInformations).toEqual([
      {
        name: 'Eintritt',
        amount: 12.5,
        groupPrice: false,
        ageFrom: 0,
        ageTo: 17,
        maxAdultCount: 2,
        maxChildrenCount: 4,
        description: 'Regulär',
        category: 'Erwachsene',
      },
      { amount: Number.NaN },
    ]);
  });
});
