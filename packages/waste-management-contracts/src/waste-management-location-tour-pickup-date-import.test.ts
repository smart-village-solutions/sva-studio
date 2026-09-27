import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  detectWasteImportCsvDelimiter,
  normalizeWasteImportPickupDate,
  parseWasteLocationTourPickupDateCsv,
} from './waste-management-location-tour-pickup-date-import.js';

const formatUtcDate = (value: Date): string => value.toISOString().slice(0, 10);
const earliestFourDigitUtcDate = new Date(Date.UTC(1000, 0, 1));
const latestFourDigitUtcDate = new Date(Date.UTC(9999, 11, 31, 23, 59, 59, 999));

describe('waste location tour assignment import parser', () => {
  it('keeps canonical pickup dates stable for arbitrary UTC calendar dates', () => {
    fc.assert(
      fc.property(
        fc.date({ min: earliestFourDigitUtcDate, max: latestFourDigitUtcDate }),
        (value) => {
          const canonicalDate = formatUtcDate(value);

          expect(normalizeWasteImportPickupDate(canonicalDate)).toBe(canonicalDate);
        }
      )
    );
  });

  it('detects delimiters with semicolon as the stable fallback', () => {
    expect(detectWasteImportCsvDelimiter('Region;Ort;Straße;Hausnummern;Hausmüll')).toBe(';');
    expect(detectWasteImportCsvDelimiter('Ort,Straße,Hausmüll,Papier')).toBe(',');
    expect(detectWasteImportCsvDelimiter('Ort\tStraße\tHausmüll\tPapier')).toBe('\t');
    expect(detectWasteImportCsvDelimiter('Ort|Straße|Hausmüll|Papier')).toBe('|');
    expect(detectWasteImportCsvDelimiter('Ort Straße Hausmüll Papier')).toBe(';');
  });

  it('parses valid rows with optional region and house-number columns and ignores trailing empty headers', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: [
        'Ort;Straße;Hausmüll;Papier;Gelbe Säcke;;;;',
        'Perleberg;Ackerstr.;HM.3.3;PPK.7.2;LVP.9.4;;;;',
        'Bad Wilsnack;;;PPK.1.1;;;;;',
        'Musterort;;;;;;;;',
      ].join('\n'),
    });

    expect(result.detectedDelimiter).toBe(';');
    expect(result.fractionNames).toEqual(['Hausmüll', 'Papier', 'Gelbe Säcke']);
    expect(result.validRowCount).toBe(2);
    expect(result.invalidRowCount).toBe(1);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        region: undefined,
        city: 'Perleberg',
        street: 'Ackerstr.',
        houseNumbers: 'Alle Hausnummern',
        tourNamesByFractionName: {
          Hausmüll: 'HM.3.3',
          Papier: 'PPK.7.2',
          'Gelbe Säcke': 'LVP.9.4',
        },
      },
      {
        rowNumber: 3,
        region: undefined,
        city: 'Bad Wilsnack',
        street: 'Alle Straßen',
        houseNumbers: 'Alle Hausnummern',
        tourNamesByFractionName: {
          Papier: 'PPK.1.1',
        },
      },
    ]);
    expect(result.issues).toEqual([
      {
        rowNumber: 4,
        column: 'Fraktionsspalten',
        message: 'Die Zeile enthält keine verwertbare Tourzuordnung.',
      },
    ]);
  });

  it('accepts an optional region header and rejects malformed address prefixes', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: 'Straße;Ort;Hausmüll\nHauptstraße;Musterstadt;Tour 1\n',
    });

    expect(result.validRowCount).toBe(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 1,
          column: 'Ort',
        }),
        expect.objectContaining({
          rowNumber: 1,
          column: 'Adressspalten',
        }),
      ])
    );
  });

  it('returns a deterministic issue for empty csv files', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: '',
    });

    expect(result).toEqual({
      delimiter: ';',
      detectedDelimiter: ';',
      header: [],
      fractionNames: [],
      rows: [],
      validRowCount: 0,
      invalidRowCount: 0,
      issues: [
        {
          rowNumber: 1,
          column: 'Datei',
          message: 'Die CSV-Datei ist leer.',
        },
      ],
    });
  });

  it('keeps delimiters inside quoted cells and reports duplicate fraction columns', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: ['Ort;Papier;Papier', '"Perleberg; Süd";"PPK;1";PPK.2'].join('\n'),
    });

    expect(result.header).toEqual(['Ort', 'Papier', 'Papier']);
    expect(result.fractionNames).toEqual(['Papier', 'Papier']);
    expect(result.validRowCount).toBe(1);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        region: undefined,
        city: 'Perleberg; Süd',
        street: 'Alle Straßen',
        houseNumbers: 'Alle Hausnummern',
        tourNamesByFractionName: {
          Papier: 'PPK.2',
        },
      },
    ]);
    expect(result.issues).toEqual([
      {
        rowNumber: 1,
        column: 'Papier',
        message: 'Fraktionsspaltennamen müssen eindeutig sein.',
        value: 'Papier',
      },
    ]);
  });

  it('rejects duplicate fraction columns case-insensitively', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: ['Ort;Bio;bio', 'Perleberg;BIO.1;BIO.2'].join('\n'),
    });

    expect(result.issues).toEqual([
      {
        rowNumber: 1,
        column: 'Bio',
        message: 'Fraktionsspaltennamen müssen eindeutig sein.',
        value: 'Bio',
      },
      {
        rowNumber: 1,
        column: 'bio',
        message: 'Fraktionsspaltennamen müssen eindeutig sein.',
        value: 'bio',
      },
    ]);
  });

  it('rejects rows with missing city and rows without any named fraction columns', () => {
    const missingCity = parseWasteLocationTourPickupDateCsv({
      text: 'Ort;Papier\n;PPK.7.2\n',
    });
    const missingFractions = parseWasteLocationTourPickupDateCsv({
      text: 'Ort\nPerleberg\n',
    });

    expect(missingCity.validRowCount).toBe(0);
    expect(missingCity.invalidRowCount).toBe(1);
    expect(missingCity.issues).toEqual([
      {
        rowNumber: 2,
        column: 'Ort',
        message: 'Ort ist ein Pflichtfeld.',
      },
    ]);

    expect(missingFractions.validRowCount).toBe(0);
    expect(missingFractions.invalidRowCount).toBe(1);
    expect(missingFractions.issues).toEqual([
      {
        rowNumber: 1,
        column: 'Fraktionsspalten',
        message: 'Mindestens eine Fraktionsspalte wird benötigt.',
      },
      {
        rowNumber: 2,
        column: 'Fraktionsspalten',
        message: 'Die Zeile enthält keine verwertbare Tourzuordnung.',
      },
    ]);
  });

  it('strips a utf-8 bom and respects an explicit delimiter override', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: '\uFEFFOrt,Restmüll\nPerleberg,HM.1\n',
      delimiterOverride: ',',
    });

    expect(result.detectedDelimiter).toBe(',');
    expect(result.delimiter).toBe(',');
    expect(result.header).toEqual(['Ort', 'Restmüll']);
    expect(result.validRowCount).toBe(1);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      region: undefined,
      city: 'Perleberg',
      street: 'Alle Straßen',
      houseNumbers: 'Alle Hausnummern',
      tourNamesByFractionName: {
        Restmüll: 'HM.1',
      },
    });
  });

  it('reports empty fraction headers between named columns and keeps escaped quotes inside cells', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: ['Ort;Restmüll;;Papier', '"Perleberg ""Nord""";HM.1;;PPK.2'].join('\n'),
    });

    expect(result.validRowCount).toBe(1);
    expect(result.rows[0]?.city).toBe('Perleberg "Nord"');
    expect(result.fractionNames).toEqual(['Restmüll', 'Papier']);
    expect(result.issues).toEqual([
      {
        rowNumber: 1,
        column: 'Spalte 3',
        message: 'Fraktionsspalten dürfen zwischen benannten Spalten nicht leer sein.',
      },
    ]);
  });

  it('handles optional region, street and house number columns while skipping empty rows', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: [
        'Region;Ort;Straße;Hausnummern;Papier',
        '',
        'Nord;Musterstadt;Hauptstraße;12;PPK.7.2',
      ].join('\n'),
    });

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 3,
        region: 'Nord',
        city: 'Musterstadt',
        street: 'Hauptstraße',
        houseNumbers: '12',
        tourNamesByFractionName: {
          Papier: 'PPK.7.2',
        },
      },
    ]);
  });

  it('parses optional pickup-date and note columns ahead of fraction assignments', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: [
        'Ort;Straße;Hausnummern;Abholdatum;Hinweis;Papier;Bioabfall',
        'Perleberg;Ackerstraße;12;2026-02-03;  Schnee-Ersatztermin  ;PPK.7.2;BIO.3.1',
      ].join('\n'),
    });

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        region: undefined,
        city: 'Perleberg',
        street: 'Ackerstraße',
        houseNumbers: '12',
        pickupDate: '2026-02-03',
        note: 'Schnee-Ersatztermin',
        tourNamesByFractionName: {
          Papier: 'PPK.7.2',
          Bioabfall: 'BIO.3.1',
        },
      },
    ]);
  });

  it('parses a stable assignment id before the address columns', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: [
        'Einsatz-ID;Ort;Straße;Abholdatum;Hinweis;Schadstoffmobil',
        '73d06a46-9a54-4db3-8a41-b67c3ec9d88d;Perleberg;;2026-06-10;;SM.1',
      ].join('\n'),
    });

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      assignmentId: '73d06a46-9a54-4db3-8a41-b67c3ec9d88d',
      city: 'Perleberg',
      pickupDate: '2026-06-10',
      note: undefined,
    });
  });

  it('requires a pickup date for assignment rows while keeping legacy rows compatible', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: [
        'Einsatz-ID;Ort;Schadstoffmobil',
        '73d06a46-9a54-4db3-8a41-b67c3ec9d88d;Perleberg;SM.1',
      ].join('\n'),
    });

    expect(result.validRowCount).toBe(0);
    expect(result.issues).toContainEqual({
      rowNumber: 2,
      column: 'Abholdatum',
      message: 'Zeilen mit Einsatz-ID benötigen ein Abholdatum.',
    });
  });

  it('rejects invalid pickup-date values instead of dropping them silently', () => {
    const result = parseWasteLocationTourPickupDateCsv({
      text: ['Ort;Abholdatum;Papier', 'Perleberg;2026-02-30;PPK.7.2'].join('\n'),
    });

    expect(result.validRowCount).toBe(0);
    expect(result.invalidRowCount).toBe(1);
    expect(result.issues).toEqual([
      {
        rowNumber: 2,
        column: 'Abholdatum',
        message: 'Abholdatum muss als ISO-Datum im Format YYYY-MM-DD angegeben werden.',
        value: '2026-02-30',
      },
    ]);
  });

  it('detects delimiters correctly when escaped quotes appear inside quoted header cells', () => {
    expect(detectWasteImportCsvDelimiter('"Papier ""Blau""";Ort;Tour')).toBe(';');
  });

  it('normalizes strict iso pickup dates and rejects invalid values', () => {
    expect(normalizeWasteImportPickupDate(' 2026-05-18 ')).toBe('2026-05-18');
    expect(normalizeWasteImportPickupDate('2026-00-01')).toBeNull();
    expect(normalizeWasteImportPickupDate('2026-02-30')).toBeNull();
    expect(normalizeWasteImportPickupDate('18.05.2026')).toBeNull();
    expect(normalizeWasteImportPickupDate('')).toBeNull();
  });
});
