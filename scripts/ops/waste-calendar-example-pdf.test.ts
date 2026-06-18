import { expect, it } from 'vitest';

import {
  buildWasteCalendarDocument,
  renderWasteCalendarPdf,
  type WasteCalendarMonth,
} from './waste-calendar-example-pdf.ts';

it('buildWasteCalendarDocument returns exactly two half-year pages', () => {
  const document = buildWasteCalendarDocument();

  expect(document.pages).toHaveLength(2);
  expect(
    document.pages.map((page) => page.months.map((month) => month.month)),
  ).toEqual([
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    ]);
});

it('each page contains the expected legend and placeholder branding data', () => {
  const document = buildWasteCalendarDocument();

  for (const page of document.pages) {
    expect(page.title).toBe('Abfallkalender 2026');
    expect(page.locationLabel).toMatch(/Musterstadt/);
    expect(page.brandingPlaceholderLabel).toBe('Logo / Bild');
    expect(
      page.legend.map((entry) => `${entry.code}:${entry.label}`),
    ).toEqual([
        'AG:Fälligkeit Abfallgebühr',
        'Bio:Biotonne',
        'HM:Hausmüll',
        'PPK:Papier, Pappe, Karton',
        'LVP:Leichtverpackungen (gelber Sack)',
        'SM:Schadstoffmobil',
      ]);
    expect(page.notes[0]?.includes('Schadstoffmobil')).toBe(true);
    expect(page.footerLine.includes('Musterstadt')).toBe(true);
  }
});

it('months contain realistic placeholder waste entries and named holidays', () => {
  const document = buildWasteCalendarDocument();
  const january = document.pages[0]?.months[0];
  const april = document.pages[0]?.months[3];

  expect(january).toBeDefined();
  expect(april).toBeDefined();

  expect(findDay(january, 1)?.holidayLabel).toBe('Neujahr');
  expect(
    findDay(january, 14)?.entries.map((entry) => entry.code),
  ).toEqual(['HM']);
  expect(
    findDay(january, 15)?.entries.map((entry) => entry.code),
  ).toEqual(['LVP', 'Bio']);
  expect(findDay(april, 3)?.holidayLabel).toBe('Karfreitag');
  expect(
    findDay(april, 16)?.entries.map((entry) => entry.code),
  ).toEqual(['SM']);
});

it('renderWasteCalendarPdf returns a valid two-page PDF buffer', () => {
  const pdfBuffer = renderWasteCalendarPdf(buildWasteCalendarDocument());
  const pdfText = pdfBuffer.toString('latin1');

  expect(pdfBuffer.toString('latin1', 0, 8)).toMatch(/^%PDF-1\./);
  expect(pdfText.match(/\/Type \/Page\b/g) ?? []).toHaveLength(2);
  expect(pdfText).toMatch(/Abfallkalender 2026/);
  expect(pdfText).toMatch(/Januar/);
  expect(pdfText).toMatch(/Juli/);
  expect(pdfText).toMatch(/März/);
  expect(pdfText).toMatch(/Schadstoffmobil/);
});

function findDay(
  month: WasteCalendarMonth,
  dayNumber: number
): WasteCalendarMonth['days'][number] | undefined {
  return month.days.find((day) => day.dayOfMonth === dayNumber);
}
