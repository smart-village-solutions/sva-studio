import { describe, expect, it, vi } from 'vitest';

import {
  createBrandingImageResource,
  getContrastingTextColor,
  getEntryLabelWidth,
  pad2,
  getHelveticaTextWidth,
  wrapHelveticaText,
} from './waste-management-output.render.helpers.js';

describe('waste-management-output.render.helpers', () => {
  it('wraps at words, preserves paragraph breaks and splits words wider than the column', () => {
    const lines = wrapHelveticaText('Bio Papier Glas\n\nWWWWWWWWWW', 8, 36);
    expect(lines).toEqual(['Bio', 'Papier', 'Glas', '', 'WWWW', 'WWWW', 'WW']);
    expect(lines.every((line) => getHelveticaTextWidth(line, 8) <= 36)).toBe(true);
  });

  it('pads single-digit numbers and leaves two digits untouched', () => {
    expect(pad2(4)).toBe('04');
    expect(pad2(12)).toBe('12');
  });

  it('returns width variants for short, medium, and long entry labels', () => {
    expect(getEntryLabelWidth('A')).toBe(18);
    expect(getEntryLabelWidth('ABC')).toBe(22);
    expect(getEntryLabelWidth('ABCD')).toBe(26);
  });

  it('chooses black or white text according to the greater contrast', () => {
    expect(getContrastingTextColor([0.1, 0.1, 0.1])).toEqual([1, 1, 1]);
    expect(getContrastingTextColor([0.9, 0.9, 0.9])).toEqual([0, 0, 0]);
    expect(getContrastingTextColor([0.5, 0.5, 0.5])).toEqual([0, 0, 0]);
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
              rgbData: new Uint8Array([
                255, 255, 255, 0, 0, 0, 127, 127, 127, 5, 5, 5, 10, 10, 10, 15, 15, 15,
              ]),
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
