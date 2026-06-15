import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';

type RgbColor = readonly [red: number, green: number, blue: number];

export type { RgbColor };

export const BRANDING_BOX = {
  x: 640,
  top: 22,
  width: 163,
  height: 48,
  padding: 6,
} as const;

export const splitLegendLabel = (label: string): readonly string[] => {
  if (label.length <= 24) {
    return [label];
  }

  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > 24 && current.length > 0) {
      lines.push(current);
      current = word;
      continue;
    }
    current = next;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
};

export const pad2 = (value: number): string => value.toString().padStart(2, '0');

export const abbreviateHolidayLabel = (label: string): string => {
  switch (label) {
    case 'Christi Himmelfahrt':
      return 'Christi Himmelf.';
    case 'Tag der Deutschen Einheit':
      return 'Tag d. Dt. Einheit';
    default:
      return label;
  }
};

export const getEntryLabelWidth = (code: string): number => {
  if (code.length <= 2) {
    return 18;
  }
  if (code.length === 3) {
    return 22;
  }
  return 26;
};

export const buildBrandingImageCommand = (
  page: WasteCalendarPdfDocument['pages'][number],
  imageObjectName: string,
  pageHeight: number
): string | null => {
  const image = page.brandingImage;
  if (!image) {
    return null;
  }

  const usableWidth = BRANDING_BOX.width - BRANDING_BOX.padding * 2;
  const usableHeight = BRANDING_BOX.height - BRANDING_BOX.padding * 2;
  const scale = Math.min(usableWidth / image.width, usableHeight / image.height);
  const targetWidth = image.width * scale;
  const targetHeight = image.height * scale;
  const x = BRANDING_BOX.x + (BRANDING_BOX.width - targetWidth) / 2;
  const y = pageHeight - BRANDING_BOX.top - BRANDING_BOX.height + (BRANDING_BOX.height - targetHeight) / 2;
  return `q ${targetWidth.toFixed(2)} 0 0 ${targetHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${imageObjectName} Do Q`;
};

export const createBrandingImageResource = (input: {
  readonly document: WasteCalendarPdfDocument;
  readonly addStreamObject: (streamContent: Buffer, dictionary: string) => number;
}) => {
  const brandingImage = input.document.pages.find((page) => page.brandingImage)?.brandingImage;
  if (!brandingImage) {
    return null;
  }

  return {
    id: input.addStreamObject(
      Buffer.from(brandingImage.rgbData),
      `/Type /XObject /Subtype /Image /Width ${brandingImage.width} /Height ${brandingImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8`
    ),
    objectName: 'Im1',
  } as const;
};
