import type { WasteManagementCsvDelimiter } from './waste-management-operations-contract.js';
import {
  type WasteLocationTourPickupDateImportIssue,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportRow,
  wasteLocationTourPickupDateImportDefaults,
} from './waste-management-location-tour-pickup-date-import.types.js';

type ParsedHeaderLayout = {
  readonly assignmentIdIndex?: number;
  readonly hasRegionColumn: boolean;
  readonly cityIndex: number;
  readonly streetIndex?: number;
  readonly houseNumbersIndex?: number;
  readonly pickupDateIndex?: number;
  readonly noteIndex?: number;
  readonly fractionStartIndex: number;
};

type OptionalHeaderIndexes = Pick<
  ParsedHeaderLayout,
  'streetIndex' | 'houseNumbersIndex' | 'pickupDateIndex' | 'noteIndex'
>;

const consumeOptionalHeaders = (
  header: readonly string[],
  startIndex: number
): OptionalHeaderIndexes & { readonly nextIndex: number } => {
  const indexes: Partial<Record<keyof OptionalHeaderIndexes, number>> = {};
  let cursor = startIndex;
  const optionalHeaders = [
    ['streetIndex', 'Straße'],
    ['houseNumbersIndex', 'Hausnummern'],
    ['pickupDateIndex', 'Abholdatum'],
    ['noteIndex', 'Hinweis'],
  ] as const;

  for (const [property, label] of optionalHeaders) {
    if ((header[cursor] ?? '').trim() !== label) {
      continue;
    }
    indexes[property] = cursor;
    cursor += 1;
  }

  return { ...indexes, nextIndex: cursor };
};

const splitCsvLine = (line: string, delimiter: WasteManagementCsvDelimiter): readonly string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const countDelimiterOccurrences = (
  line: string,
  delimiter: WasteManagementCsvDelimiter
): number => {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

export const detectWasteImportCsvDelimiter = (headerLine: string): WasteManagementCsvDelimiter => {
  const ranking = wasteLocationTourPickupDateImportDefaults.supportedDelimiters
    .map((delimiter) => ({
      delimiter,
      count: countDelimiterOccurrences(headerLine, delimiter),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.delimiter === ';' ? -1 : right.delimiter === ';' ? 1 : 0;
    });

  return ranking[0]?.count && ranking[0].count > 0 ? ranking[0].delimiter : ';';
};

const isEmptyRow = (cells: readonly string[]): boolean =>
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

const parseHeaderLayout = (
  header: readonly string[],
  issues: WasteLocationTourPickupDateImportIssue[]
): ParsedHeaderLayout | null => {
  let cursor = 0;
  const assignmentIdIndex = (header[cursor] ?? '').trim() === 'Einsatz-ID' ? cursor : undefined;
  if (assignmentIdIndex !== undefined) {
    cursor += 1;
  }
  const hasRegionColumn = (header[cursor] ?? '').trim() === 'Region';
  if (hasRegionColumn) {
    cursor += 1;
  }

  if ((header[cursor] ?? '').trim() !== 'Ort') {
    issues.push({
      rowNumber: 1,
      column: 'Ort',
      message: hasRegionColumn
        ? 'Nach der optionalen Spalte "Region" muss die Spalte "Ort" folgen.'
        : 'Die erste Pflichtspalte muss "Ort" heißen.',
      value: header[cursor] ?? '',
    });
    issues.push({
      rowNumber: 1,
      column: 'Adressspalten',
      message:
        'Der Adressblock muss mit "Ort" beginnen und darf optional "Region", "Straße" und "Hausnummern" enthalten.',
    });
    return null;
  }

  const cityIndex = cursor;
  cursor += 1;
  const optionalHeaders = consumeOptionalHeaders(header, cursor);

  return {
    assignmentIdIndex,
    hasRegionColumn,
    cityIndex,
    streetIndex: optionalHeaders.streetIndex,
    houseNumbersIndex: optionalHeaders.houseNumbersIndex,
    pickupDateIndex: optionalHeaders.pickupDateIndex,
    noteIndex: optionalHeaders.noteIndex,
    fractionStartIndex: optionalHeaders.nextIndex,
  };
};

const parseFractionNames = (
  header: readonly string[],
  headerLayout: ParsedHeaderLayout | null,
  issues: WasteLocationTourPickupDateImportIssue[]
): readonly string[] => {
  if (!headerLayout) {
    return [];
  }

  const fractionHeaders = header
    .slice(headerLayout.fractionStartIndex)
    .map((value) => value.trim());
  const lastNamedIndex = fractionHeaders.reduce(
    (lastIndex, value, index) => (value.length > 0 ? index : lastIndex),
    -1
  );
  const fractionNames: string[] = [];

  for (const [index, fractionName] of fractionHeaders.entries()) {
    if (index > lastNamedIndex) {
      break;
    }
    if (!fractionName) {
      issues.push({
        rowNumber: 1,
        column: `Spalte ${headerLayout.fractionStartIndex + index + 1}`,
        message: 'Fraktionsspalten dürfen zwischen benannten Spalten nicht leer sein.',
      });
      continue;
    }
    fractionNames.push(fractionName);
  }

  if (fractionNames.length === 0) {
    issues.push({
      rowNumber: 1,
      column: 'Fraktionsspalten',
      message: 'Mindestens eine Fraktionsspalte wird benötigt.',
    });
  }

  const fractionNamesByNormalizedKey = fractionNames.reduce<Map<string, Set<string>>>(
    (groups, fractionName) => {
      const normalizedKey = fractionName.toLocaleLowerCase('de-DE');
      const values = groups.get(normalizedKey) ?? new Set<string>();
      values.add(fractionName);
      groups.set(normalizedKey, values);
      return groups;
    },
    new Map()
  );

  for (const fractionNamesForKey of fractionNamesByNormalizedKey.values()) {
    if (
      fractionNamesForKey.size < 2 &&
      fractionNames.filter((fractionName) => fractionNamesForKey.has(fractionName)).length < 2
    ) {
      continue;
    }
    for (const fractionName of fractionNamesForKey) {
      issues.push({
        rowNumber: 1,
        column: fractionName,
        message: 'Fraktionsspaltennamen müssen eindeutig sein.',
        value: fractionName,
      });
    }
  }

  return fractionNames;
};

const parseDataRow = (input: {
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

  const assignmentId =
    headerLayout.assignmentIdIndex === undefined
      ? ''
      : (cells[headerLayout.assignmentIdIndex]?.trim() ?? '');
  const region = headerLayout.hasRegionColumn
    ? (cells[headerLayout.assignmentIdIndex === undefined ? 0 : 1]?.trim() ?? '')
    : '';
  const city = cells[headerLayout.cityIndex]?.trim() ?? '';
  const rawStreet =
    headerLayout.streetIndex === undefined ? '' : (cells[headerLayout.streetIndex]?.trim() ?? '');
  const rawHouseNumbers =
    headerLayout.houseNumbersIndex === undefined
      ? ''
      : (cells[headerLayout.houseNumbersIndex]?.trim() ?? '');
  const pickupDate =
    headerLayout.pickupDateIndex === undefined
      ? ''
      : (cells[headerLayout.pickupDateIndex]?.trim() ?? '');
  const note =
    headerLayout.noteIndex === undefined ? '' : (cells[headerLayout.noteIndex]?.trim() ?? '');
  const rowIssuesBefore = issues.length;

  if (!city) {
    issues.push({
      rowNumber,
      column: 'Ort',
      message: 'Ort ist ein Pflichtfeld.',
    });
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

  const tourNamesByFractionName = Object.fromEntries(
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

export const parseWasteLocationTourPickupDateCsv = (input: {
  readonly text: string;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
}): WasteLocationTourPickupDateImportParseResult => {
  const normalizedText = input.text
    .replace(/^\uFEFF/, '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n');
  const lines = normalizedText
    .split('\n')
    .filter((line, index, source) => !(index === source.length - 1 && line === ''));
  if (lines.length === 0) {
    return {
      delimiter: input.delimiterOverride ?? ';',
      detectedDelimiter: ';',
      header: [],
      fractionNames: [],
      rows: [],
      validRowCount: 0,
      invalidRowCount: 0,
      issues: [{ rowNumber: 1, column: 'Datei', message: 'Die CSV-Datei ist leer.' }],
    };
  }

  const detectedDelimiter = detectWasteImportCsvDelimiter(lines[0] ?? '');
  const delimiter = input.delimiterOverride ?? detectedDelimiter;
  const header = splitCsvLine(lines[0] ?? '', delimiter);
  const issues: WasteLocationTourPickupDateImportIssue[] = [];
  const headerLayout = parseHeaderLayout(header, issues);
  const fractionNames = parseFractionNames(header, headerLayout, issues);
  const rows: WasteLocationTourPickupDateImportRow[] = [];
  let invalidRowCount = 0;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex] ?? '', delimiter);
    if (isEmptyRow(cells)) {
      continue;
    }

    const row = parseDataRow({
      cells,
      rowNumber: lineIndex + 1,
      headerLayout,
      fractionNames,
      issues,
    });

    if (!row) {
      invalidRowCount += 1;
      continue;
    }

    rows.push(row);
  }

  return {
    delimiter,
    detectedDelimiter,
    header,
    fractionNames,
    rows,
    validRowCount: rows.length,
    invalidRowCount,
    issues,
  };
};
