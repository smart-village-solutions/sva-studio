import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';

type RgbColor = readonly [red: number, green: number, blue: number];

export type { RgbColor };

export const BRANDING_BOX = {
  x: 640,
  top: 14,
  width: 163,
  height: 40,
  padding: 5,
} as const;

const HELVETICA_WIDTHS: Readonly<Record<string, number>> = {
  ' ': 278,
  '!': 278,
  '"': 355,
  '#': 556,
  '$': 556,
  '%': 889,
  '&': 667,
  "'": 191,
  '(': 333,
  ')': 333,
  '*': 389,
  '+': 584,
  ',': 278,
  '-': 333,
  '.': 278,
  '/': 278,
  ':': 278,
  ';': 278,
  '<': 584,
  '=': 584,
  '>': 584,
  '?': 556,
  '@': 1015,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  Ä: 667,
  Ö: 778,
  Ü: 722,
  ä: 556,
  ö: 556,
  ü: 556,
  ß: 556,
};

const getHelveticaCharacterWidth = (character: string): number => {
  const knownWidth = HELVETICA_WIDTHS[character];
  if (knownWidth !== undefined) {
    return knownWidth;
  }
  return 556;
};

export const getHelveticaTextWidth = (text: string, fontSize: number): number =>
  Array.from(text).reduce((width, character) => width + getHelveticaCharacterWidth(character), 0) *
  (fontSize / 1000);

export const truncateHelveticaText = (
  text: string,
  fontSize: number,
  maxWidth: number
): string => {
  if (getHelveticaTextWidth(text, fontSize) <= maxWidth) {
    return text;
  }

  const suffix = '...';
  const suffixWidth = getHelveticaTextWidth(suffix, fontSize);
  let visibleText = '';
  let visibleWidth = 0;
  for (const character of Array.from(text)) {
    const characterWidth = getHelveticaTextWidth(character, fontSize);
    if (visibleWidth + characterWidth + suffixWidth > maxWidth) {
      break;
    }
    visibleText += character;
    visibleWidth += characterWidth;
  }

  return `${visibleText.trimEnd()}${suffix}`;
};

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
