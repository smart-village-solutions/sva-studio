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
