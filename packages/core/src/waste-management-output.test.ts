import { describe, expect, it } from 'vitest';

import { buildWasteCalendarPdfDocument, renderWasteCalendarPdf } from './waste-management-output.js';

describe('waste-management output pdf', () => {
  it('builds a two-page yearly document with mapped pickup entries', () => {
    const document = buildWasteCalendarPdfDocument({
      year: 2026,
      locationLabel: 'Rathenow, Berliner Str. 12',
      pickups: [
        {
          date: '2026-01-14',
          fractions: [{ id: 'hm', label: 'Hausmuell', color: '#666666' }],
        },
        {
          date: '2026-01-15',
          fractions: [
            { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
            { id: 'papier', label: 'Papier und Pappe', color: '#3366FF' },
          ],
        },
        {
          date: '2026-10-03',
          fractions: [{ id: 'lvp', label: 'Leichtverpackungen', color: '#FFDD00' }],
        },
      ],
    });

    expect(document.pages).toHaveLength(2);
    expect(document.pages[0]?.months.map((month) => month.month)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(document.pages[1]?.months.map((month) => month.month)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(document.pages[0]?.locationLabel).toBe('Rathenow, Berliner Str. 12');

    const january = document.pages[0]?.months[0];
    const october = document.pages[1]?.months[3];
    expect(january?.days.find((day) => day.dayOfMonth === 14)?.entries.map((entry) => entry.code)).toEqual(['HAU']);
    expect(january?.days.find((day) => day.dayOfMonth === 15)?.entries).toHaveLength(2);
    expect(october?.days.find((day) => day.dayOfMonth === 3)?.holidayLabel).toBe('Tag der Deutschen Einheit');
    expect(document.pages[0]?.legend.map((entry) => entry.label)).toEqual([
      'Bioabfall',
      'Hausmuell',
      'Leichtverpackungen',
      'Papier und Pappe',
    ]);
  });

  it('renders a valid two-page pdf buffer', () => {
    const pdf = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', color: '#666666' }],
          },
        ],
      })
    );
    const pdfText = pdf.toString('latin1');

    expect(pdf.toString('latin1', 0, 8)).toMatch(/^%PDF-1\./);
    expect((pdfText.match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
    expect(pdfText).toContain('Abfallkalender 2026');
    expect(pdfText).toContain('Rathenow, Berliner Str. 12');
    expect(pdfText).toContain('Januar');
    expect(pdfText).toContain('Juli');
    expect(pdfText).toContain('Hausmuell');
  });
});
