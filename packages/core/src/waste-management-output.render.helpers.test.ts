import { describe, expect, it, vi } from 'vitest';

import {
  abbreviateHolidayLabel,
  createBrandingImageResource,
  getEntryLabelWidth,
  pad2,
  splitLegendLabel,
} from './waste-management-output.render.helpers.js';

describe('waste-management-output.render.helpers', () => {
  it('keeps short legend labels intact and wraps long labels on whitespace', () => {
    expect(splitLegendLabel('Bio')).toEqual(['Bio']);
    expect(splitLegendLabel('Sehr lange Legende fuer den Abfallkalender')).toEqual([
      'Sehr lange Legende fuer',
      'den Abfallkalender',
    ]);
  });

  it('pads single-digit numbers and leaves two digits untouched', () => {
    expect(pad2(4)).toBe('04');
    expect(pad2(12)).toBe('12');
  });

  it('abbreviates only the configured holiday labels', () => {
    expect(abbreviateHolidayLabel('Christi Himmelfahrt')).toBe('Christi Himmelf.');
    expect(abbreviateHolidayLabel('Tag der Deutschen Einheit')).toBe('Tag d. Dt. Einheit');
    expect(abbreviateHolidayLabel('Pfingstmontag')).toBe('Pfingstmontag');
  });

  it('returns width variants for short, medium, and long entry labels', () => {
    expect(getEntryLabelWidth('A')).toBe(18);
    expect(getEntryLabelWidth('ABC')).toBe(22);
    expect(getEntryLabelWidth('ABCD')).toBe(26);
  });

  it('passes raw image dictionary entries to the pdf builder without nested brackets', () => {
    const addStreamObject = vi.fn(() => 17);

    const resource = createBrandingImageResource({
      document: {
        pages: [
          {
            brandingImage: {
              width: 4,
              height: 2,
              rgbData: new Uint8Array([255, 255, 255, 0, 0, 0, 127, 127, 127, 5, 5, 5, 10, 10, 10, 15, 15, 15]),
            },
          },
        ],
      } as never,
      addStreamObject,
    });

    expect(resource).toEqual({
      id: 17,
      objectName: 'Im1',
    });
    expect(addStreamObject).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining('/Type /XObject /Subtype /Image')
    );
    expect(addStreamObject.mock.calls[0]?.[1].startsWith('<<')).toBe(false);
  });
});
