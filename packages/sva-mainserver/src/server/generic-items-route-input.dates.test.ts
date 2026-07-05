import { describe, expect, it } from 'vitest';

import { parseDates } from './generic-items-route-input.dates.js';

const expectInvalidRequest = async (response: Response) => {
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: 'invalid_request',
    message: expect.any(String),
  });
};

describe('generic-items-route-input.dates', () => {
  it('parses sparse and fully populated date entries without manufacturing fields', () => {
    expect(
      parseDates([
        {
          weekday: ' MO ',
          dateStart: '2026-08-01',
          dateEnd: '2026-08-02',
          timeStart: '09:00',
          timeEnd: '17:00',
          timeDescription: ' ganztägig ',
          useOnlyTimeDescription: true,
        },
        {},
      ])
    ).toEqual([
      {
        weekday: 'MO',
        dateStart: '2026-08-01',
        dateEnd: '2026-08-02',
        timeStart: '09:00',
        timeEnd: '17:00',
        timeDescription: 'ganztägig',
        useOnlyTimeDescription: true,
      },
      {},
    ]);
  });

  it('returns validation errors for malformed date payloads', async () => {
    await expectInvalidRequest(parseDates('not-an-array') as Response);
    await expectInvalidRequest(parseDates([null]) as Response);
  });
});
