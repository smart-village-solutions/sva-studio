import type { WasteManagementCsvDelimiter } from './waste-management-operations-contract.js';
import {
  type WasteLocationTourPickupDateImportIssue,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportRow,
} from './waste-management-location-tour-pickup-date-import.types.js';
import {
  detectWasteImportCsvDelimiter,
  splitCsvLine,
} from './waste-management-location-tour-pickup-date-parser.csv.js';
import {
  parseHeaderLayout,
  parseFractionNames,
} from './waste-management-location-tour-pickup-date-parser.header.js';
import {
  isEmptyRow,
  parseDataRow,
} from './waste-management-location-tour-pickup-date-parser.row.js';
export { detectWasteImportCsvDelimiter } from './waste-management-location-tour-pickup-date-parser.csv.js';

const stopExportHeaders = ['Ortsteil', 'Datum', 'Wochentag', 'Zeit', 'Standort'];

const parseUnassignedStopExport = (
  lines: readonly string[],
  layout: Pick<
    WasteLocationTourPickupDateImportParseResult,
    'delimiter' | 'detectedDelimiter' | 'header'
  >
): WasteLocationTourPickupDateImportParseResult => {
  const issues: WasteLocationTourPickupDateImportIssue[] = [
    {
      rowNumber: 1,
      column: 'Datei',
      message:
        'Überführen Sie diesen Haltestellenexport in das CSV-Format „Ort – Tour – Abholdatum“. Übernehmen Sie Uhrzeit und Standort gemeinsam in die Spalte „Hinweis“.',
    },
  ];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    if (isEmptyRow(splitCsvLine(lines[lineIndex] ?? '', layout.delimiter))) continue;
    issues.push({
      rowNumber: lineIndex + 1,
      column: 'Standort',
      message:
        'Ordnen Sie dem Eintrag einen Abholort und eine Tour zu und vergeben Sie eine eigene Einsatz-ID je Halt.',
    });
  }
  return {
    ...layout,
    fractionNames: [],
    rows: [],
    validRowCount: 0,
    invalidRowCount: issues.length - 1,
    issues,
  };
};

export const parseWasteLocationTourPickupDateCsv = (input: {
  readonly text: string;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
}): WasteLocationTourPickupDateImportParseResult => {
  const normalizedText = input.text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
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
  if (
    header.length === stopExportHeaders.length &&
    stopExportHeaders.every((column, index) => column === header[index]?.trim())
  ) {
    return parseUnassignedStopExport(lines, { delimiter, detectedDelimiter, header });
  }
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
