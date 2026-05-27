import type { WasteManagementCsvDelimiter } from './waste-management-operations-contract.js';
import {
  type WasteLocationTourPickupDateImportIssue,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportRow,
  wasteLocationTourPickupDateImportDefaults,
} from './waste-management-location-tour-pickup-date-import.types.js';

type ParsedHeaderLayout = {
  readonly hasRegionColumn: boolean;
  readonly cityIndex: number;
  readonly streetIndex?: number;
  readonly houseNumbersIndex?: number;
  readonly fractionStartIndex: number;
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

const countDelimiterOccurrences = (line: string, delimiter: WasteManagementCsvDelimiter): number => {
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

const isEmptyRow = (cells: readonly string[]): boolean => cells.every((cell) => cell.trim().length === 0);

const parseHeaderLayout = (
  header: readonly string[],
  issues: WasteLocationTourPickupDateImportIssue[]
): ParsedHeaderLayout | null => {
  let cursor = 0;
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
      message: 'Der Adressblock muss mit "Ort" beginnen und darf optional "Region", "Straße" und "Hausnummern" enthalten.',
    });
    return null;
  }

  const cityIndex = cursor;
  cursor += 1;

  const streetIndex = (header[cursor] ?? '').trim() === 'Straße' ? cursor : undefined;
  if (streetIndex !== undefined) {
    cursor += 1;
  }

  const houseNumbersIndex = (header[cursor] ?? '').trim() === 'Hausnummern' ? cursor : undefined;
  if (houseNumbersIndex !== undefined) {
    cursor += 1;
  }

  return {
    hasRegionColumn,
    cityIndex,
    streetIndex,
    houseNumbersIndex,
    fractionStartIndex: cursor,
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

  const fractionHeaders = header.slice(headerLayout.fractionStartIndex).map((value) => value.trim());
  const lastNamedIndex = fractionHeaders.reduce((lastIndex, value, index) => (value.length > 0 ? index : lastIndex), -1);
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

  const fractionNamesByNormalizedKey = fractionNames.reduce<Map<string, Set<string>>>((groups, fractionName) => {
    const normalizedKey = fractionName.toLocaleLowerCase('de-DE');
    const values = groups.get(normalizedKey) ?? new Set<string>();
    values.add(fractionName);
    groups.set(normalizedKey, values);
    return groups;
  }, new Map());

  for (const fractionNamesForKey of fractionNamesByNormalizedKey.values()) {
    if (fractionNamesForKey.size < 2 && fractionNames.filter((fractionName) => fractionNamesForKey.has(fractionName)).length < 2) {
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

  const region = headerLayout.hasRegionColumn ? (cells[0]?.trim() ?? '') : '';
  const city = cells[headerLayout.cityIndex]?.trim() ?? '';
  const rawStreet = headerLayout.streetIndex === undefined ? '' : (cells[headerLayout.streetIndex]?.trim() ?? '');
  const rawHouseNumbers = headerLayout.houseNumbersIndex === undefined ? '' : (cells[headerLayout.houseNumbersIndex]?.trim() ?? '');
  const rowIssuesBefore = issues.length;

  if (!city) {
    issues.push({
      rowNumber,
      column: 'Ort',
      message: 'Ort ist ein Pflichtfeld.',
    });
  }

  const tourNamesByFractionName = Object.fromEntries(
    fractionNames
      .map((fractionName, fractionIndex) => [
        fractionName,
        cells[headerLayout.fractionStartIndex + fractionIndex]?.trim() ?? '',
      ] as const)
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
    region: region || undefined,
    city,
    street: rawStreet || wasteLocationTourPickupDateImportDefaults.allStreetsName,
    houseNumbers: rawHouseNumbers || wasteLocationTourPickupDateImportDefaults.allHouseNumbersName,
    tourNamesByFractionName,
  };
};

export const parseWasteLocationTourPickupDateCsv = (input: {
  readonly text: string;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
}): WasteLocationTourPickupDateImportParseResult => {
  const normalizedText = input.text.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const lines = normalizedText.split('\n').filter((line, index, source) => !(index === source.length - 1 && line === ''));
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
