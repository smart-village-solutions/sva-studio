type RgbColor = readonly [red: number, green: number, blue: number];

export type { RgbColor };

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
