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
          fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
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
    expect(january?.days.find((day) => day.dayOfMonth === 14)?.entries.map((entry) => entry.code)).toEqual(['HM']);
    expect(january?.days.find((day) => day.dayOfMonth === 15)?.entries).toHaveLength(2);
    expect(october?.days.find((day) => day.dayOfMonth === 3)?.holidayLabel).toBe('Tag der Deutschen Einheit');
    expect(document.pages[0]?.legend.map((entry) => entry.label)).toEqual([
      'Bioabfall',
      'Hausmuell',
      'Leichtverpackungen',
      'Papier und Pappe',
    ]);
    expect(document.pages[0]?.months[2]?.label).toBe('März');
  });

  it('renders a valid two-page pdf buffer', () => {
    const pdf = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
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
    expect(pdfText).toContain('März');
    expect(pdfText).toContain('Juli');
    expect(pdfText).toContain('Hausmuell');
    expect(pdfText).toContain('HM');
  });

  it('vertically centers day content inside calendar table cells', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
          },
        ],
      })
    ).toString('latin1');

    expect(pdfText).toContain('1 0 0 1 38.00 465.23 Tm (01) Tj ET');
    expect(pdfText).toContain('1 0 0 1 58.00 465.23 Tm (Do) Tj ET');
  });

  it('uses a more compact header and leaves the footer content below the table', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
          },
        ],
        notes: ['Stand 2026-06-14'],
        footerLine: 'Abfallberatung · Beispielkontakt',
      })
    ).toString('latin1');

    expect(pdfText).toContain('/F2 24.00 Tf');
    expect(pdfText).toContain('/F1 12.00 Tf');
    expect(pdfText).toMatch(/1 0 0 1 38\.00 543\.28 Tm \(Abfallkalender 2026\) Tj ET/);
    expect(pdfText).toMatch(/1 0 0 1 38\.00 73\.08 Tm \(Stand 2026-06-14\) Tj ET/);
    expect(pdfText).toMatch(/1 0 0 1 38\.00 17\.68 Tm \(Abfallberatung · Beispielkontakt\) Tj ET/);
  });

  it('does not render default notes when an explicit empty notes array is provided', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
          },
        ],
        notes: [],
      })
    ).toString('latin1');

    expect(pdfText).not.toContain('Stand ');
    expect(pdfText).not.toContain('Alle wirksamen Fraktionen und Verschiebungen sind enthalten.');
  });

  it('embeds a branding image when one is provided', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
          },
        ],
        brandingImage: {
          width: 2,
          height: 2,
          rgbData: new Uint8Array([
            255, 0, 0,
            0, 255, 0,
            0, 0, 255,
            255, 255, 0,
          ]),
        },
      })
    ).toString('latin1');

    expect(pdfText).toContain('/Subtype /Image');
    expect(pdfText).toContain('/XObject << /Im1');
    expect(pdfText).toContain('/Im1 Do');
    expect(pdfText).not.toContain('640.00 525.28 163.00 48.00 re f');
    expect(pdfText).not.toContain('640.00 525.28 163.00 48.00 re S');
  });

  it('renders legend labels in one horizontal row beneath the calendar', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [
              { id: 'fraction-1', label: 'Fraktion 1', color: '#111111' },
              { id: 'fraction-2', label: 'Fraktion 2', color: '#222222' },
              { id: 'fraction-3', label: 'Fraktion 3', color: '#333333' },
              { id: 'fraction-4', label: 'Fraktion 4', color: '#444444' },
              { id: 'fraction-5', label: 'Fraktion 5', color: '#555555' },
              { id: 'fraction-6', label: 'Fraktion 6', color: '#666666' },
              { id: 'fraction-7', label: 'Fraktion 7', color: '#777777' },
            ],
          },
        ],
      })
    ).toString('latin1');

    const extractLegendPosition = (label: string): string | null => {
      const match = pdfText.match(new RegExp(`1 0 0 1 ([0-9.]+) ([0-9.]+) Tm \\(${label}\\) Tj ET`));
      return match ? `${match[1]}:${match[2]}` : null;
    };

    const positions = Array.from({ length: 7 }, (_, index) => extractLegendPosition(`Fraktion ${index + 1}`));
    expect(positions.every((value) => value !== null)).toBe(true);
    expect(new Set(positions).size).toBe(7);
    const yPositions = positions.map((value) => value?.split(':')[1]);
    expect(new Set(yPositions).size).toBe(1);
    expect(pdfText).toContain('1 0 0 1 42.00 85.28 Tm (F1) Tj ET');
  });
});
