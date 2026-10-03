import type { WasteManagementCsvDelimiter } from './waste-management-operations-contract.js';
import { wasteLocationTourPickupDateImportDefaults } from './waste-management-location-tour-pickup-date-import.types.js';

export const splitCsvLine = (
  line: string,
  delimiter: WasteManagementCsvDelimiter
): readonly string[] => {
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
