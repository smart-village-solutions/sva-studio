import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWasteCalendarDocument,
  renderWasteCalendarPdf,
  type WasteCalendarMonth,
} from './waste-calendar-example-pdf.ts';

test('buildWasteCalendarDocument returns exactly two half-year pages', () => {
  const document = buildWasteCalendarDocument();

  assert.equal(document.pages.length, 2);
  assert.deepEqual(
    document.pages.map((page) => page.months.map((month) => month.month)),
    [
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    ]
  );
});

test('each page contains the expected legend and placeholder branding data', () => {
  const document = buildWasteCalendarDocument();

  for (const page of document.pages) {
    assert.equal(page.title, 'Abfallkalender 2026');
    assert.match(page.locationLabel, /Musterstadt/);
    assert.equal(page.brandingPlaceholderLabel, 'Logo / Bild');
    assert.deepEqual(
      page.legend.map((entry) => `${entry.code}:${entry.label}`),
      [
        'AG:Fälligkeit Abfallgebühr',
        'Bio:Biotonne',
        'HM:Hausmüll',
        'PPK:Papier, Pappe, Karton',
        'LVP:Leichtverpackungen (gelber Sack)',
        'SM:Schadstoffmobil',
      ]
    );
    assert.ok(page.notes[0]?.includes('Schadstoffmobil'));
    assert.ok(page.footerLine.includes('Musterstadt'));
  }
});

test('months contain realistic placeholder waste entries and named holidays', () => {
  const document = buildWasteCalendarDocument();
  const january = document.pages[0]?.months[0];
  const april = document.pages[0]?.months[3];

  assert.ok(january);
  assert.ok(april);

  assert.equal(findDay(january, 1)?.holidayLabel, 'Neujahr');
  assert.deepEqual(
    findDay(january, 14)?.entries.map((entry) => entry.code),
    ['HM']
  );
  assert.deepEqual(
    findDay(january, 15)?.entries.map((entry) => entry.code),
    ['LVP', 'Bio']
  );
  assert.equal(findDay(april, 3)?.holidayLabel, 'Karfreitag');
  assert.deepEqual(
    findDay(april, 16)?.entries.map((entry) => entry.code),
    ['SM']
  );
});

test('renderWasteCalendarPdf returns a valid two-page PDF buffer', () => {
  const pdfBuffer = renderWasteCalendarPdf(buildWasteCalendarDocument());
  const pdfText = pdfBuffer.toString('latin1');

  assert.match(pdfBuffer.toString('latin1', 0, 8), /^%PDF-1\./);
  assert.equal((pdfText.match(/\/Type \/Page\b/g) ?? []).length, 2);
  assert.match(pdfText, /Abfallkalender 2026/);
  assert.match(pdfText, /Januar/);
  assert.match(pdfText, /Juli/);
  assert.match(pdfText, /März/);
  assert.match(pdfText, /Schadstoffmobil/);
});

function findDay(
  month: WasteCalendarMonth,
  dayNumber: number
): WasteCalendarMonth['days'][number] | undefined {
  return month.days.find((day) => day.dayOfMonth === dayNumber);
}
