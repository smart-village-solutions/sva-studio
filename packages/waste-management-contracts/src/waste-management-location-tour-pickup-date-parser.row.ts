import type { ParsedHeaderLayout } from './waste-management-location-tour-pickup-date-parser.header.js';
import {
  type WasteLocationTourPickupDateImportIssue,
  type WasteLocationTourPickupDateImportRow,
  wasteLocationTourPickupDateImportDefaults,
} from './waste-management-location-tour-pickup-date-import.types.js';

export const isEmptyRow = (cells: readonly string[]): boolean =>
  cells.every((cell) => cell.trim().length === 0);
const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isValidPickupDateValue = (value: string): boolean => {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const [year, month, day] = normalized.split('-').map((entry) => Number(entry));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
};

const readOptionalCell = (cells: readonly string[], index: number | undefined): string =>
  index === undefined ? '' : (cells[index]?.trim() ?? '');

const validateDataRow = (input: {
  readonly assignmentId: string;
  readonly city: string;
  readonly pickupDate: string;
  readonly rowNumber: number;
  readonly issues: WasteLocationTourPickupDateImportIssue[];
}): void => {
  const { assignmentId, city, pickupDate, rowNumber, issues } = input;
  if (!city) {
    issues.push({ rowNumber, column: 'Ort', message: 'Ort ist ein Pflichtfeld.' });
  }
  if (pickupDate && !isValidPickupDateValue(pickupDate)) {
    issues.push({
      rowNumber,
      column: 'Abholdatum',
      message: 'Abholdatum muss als ISO-Datum im Format YYYY-MM-DD angegeben werden.',
      value: pickupDate,
    });
  }
  if (assignmentId && !pickupDate) {
    issues.push({
      rowNumber,
      column: 'Abholdatum',
      message: 'Zeilen mit Einsatz-ID benötigen ein Abholdatum.',
    });
  }
  if (assignmentId && !isUuid(assignmentId)) {
    issues.push({
      rowNumber,
      column: 'Einsatz-ID',
      message: 'Einsatz-ID muss eine gültige UUID sein.',
      value: assignmentId,
    });
  }
};

const buildTourNamesByFractionName = (
  cells: readonly string[],
  headerLayout: ParsedHeaderLayout,
  fractionNames: readonly string[]
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    fractionNames
      .map(
        (fractionName, fractionIndex) =>
          [
            fractionName,
            cells[headerLayout.fractionStartIndex + fractionIndex]?.trim() ?? '',
          ] as const
      )
      .filter((entry) => entry[1].length > 0)
  );

export const parseDataRow = (input: {
  readonly cells: readonly string[];
  readonly rowNumber: number;
  readonly headerLayout: ParsedHeaderLayout | null;
  readonly fractionNames: readonly string[];
  readonly issues: WasteLocationTourPickupDateImportIssue[];
}): WasteLocationTourPickupDateImportRow | null => {
  const { cells, rowNumber, headerLayout, fractionNames, issues } = input;
  if (!headerLayout) {
    return null;
  }

  const assignmentId = readOptionalCell(cells, headerLayout.assignmentIdIndex);
  const region = headerLayout.hasRegionColumn
    ? (cells[headerLayout.assignmentIdIndex === undefined ? 0 : 1]?.trim() ?? '')
    : '';
  const city = cells[headerLayout.cityIndex]?.trim() ?? '';
  const rawStreet = readOptionalCell(cells, headerLayout.streetIndex);
  const rawHouseNumbers = readOptionalCell(cells, headerLayout.houseNumbersIndex);
  const pickupDate = readOptionalCell(cells, headerLayout.pickupDateIndex);
  const note = readOptionalCell(cells, headerLayout.noteIndex);
  const rowIssuesBefore = issues.length;

  validateDataRow({ assignmentId, city, pickupDate, rowNumber, issues });
  const tourNamesByFractionName = buildTourNamesByFractionName(cells, headerLayout, fractionNames);

  if (Object.keys(tourNamesByFractionName).length === 0) {
    issues.push({
      rowNumber,
      column: 'Fraktionsspalten',
      message: 'Die Zeile enthält keine verwertbare Tourzuordnung.',
    });
  }

  if (issues.length > rowIssuesBefore) {
    return null;
  }

  return {
    rowNumber,
    ...(assignmentId ? { assignmentId } : {}),
    region: region || undefined,
    city,
    street: rawStreet || wasteLocationTourPickupDateImportDefaults.allStreetsName,
    houseNumbers: rawHouseNumbers || wasteLocationTourPickupDateImportDefaults.allHouseNumbersName,
    pickupDate: pickupDate || undefined,
    note: note || undefined,
    tourNamesByFractionName,
  };
};
