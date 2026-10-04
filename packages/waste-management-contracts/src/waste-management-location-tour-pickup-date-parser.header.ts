import type { WasteLocationTourPickupDateImportIssue } from './waste-management-location-tour-pickup-date-import.types.js';

export type ParsedHeaderLayout = {
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

export const parseHeaderLayout = (
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

export const parseFractionNames = (
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
