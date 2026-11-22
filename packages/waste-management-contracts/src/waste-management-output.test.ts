import { describe, expect, it } from 'vitest';

import {
  buildWasteCalendarPdfDocument,
  renderWasteCalendarPdf,
} from './waste-management-output.js';

describe('waste-management output pdf', () => {
  it('renders every pickup hint alongside six fractions and a shift explanation', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Bad Wilsnack',
        pickups: [
          {
            date: '2026-09-08',
            fractions: Array.from({ length: 6 }, (_, index) => ({
              id: `fraction-${index}`,
              label: `Fraktion ${index + 1}`,
              color: '#555555',
              isShifted: index === 0,
            })),
          },
        ],
        legendHints: [
          { id: 'stop:1', label: '08.09.', description: '09:00 Uhr, Erster Haltepunkt.' },
          { id: 'stop:2', label: '08.09.', description: '10:00 Uhr, Zweiter Haltepunkt.' },
          { id: 'stop:3', label: '08.09.', description: '11:00 Uhr, Dritter Haltepunkt.' },
        ],
      })
    ).toString('latin1');

    expect(pdfText).toContain('= Ausweichtermin');
    expect(pdfText).toContain('Fraktion 6');
    expect(pdfText).toContain('09:00 Uhr, Erster Haltepunkt.');
    expect(pdfText).toContain('10:00 Uhr, Zweiter Haltepunkt.');
    expect(pdfText).toContain('11:00 Uhr, Dritter Haltepunkt.');
  });

  it('builds a two-page yearly document with mapped pickup entries', () => {
    const document = buildWasteCalendarPdfDocument({
      year: 2026,
      locationLabel: 'Rathenow, Berliner Str. 12',
      pickups: [
        {
          date: '2026-01-14',
          fractions: [
            { id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666', isShifted: true },
          ],
        },
        {
          date: '2026-01-15',
          fractions: [
            {
              id: 'bio',
              label: 'Bioabfall',
              description: 'Bitte ohne Kunststoffbeutel bereitstellen.',
              color: '#00AA00',
            },
            { id: 'papier', label: 'Papier und Pappe', color: '#3366FF' },
          ],
        },
        {
          date: '2026-10-03',
          fractions: [{ id: 'lvp', label: 'Leichtverpackungen', color: '#FFDD00' }],
        },
      ],
      legendHints: [
        { id: 'tour:nord', label: 'Tour: Nord', description: 'Bereitstellung am Fahrbahnrand.' },
      ],
    });

    expect(document.pages).toHaveLength(2);
    expect(document.pages[0]?.months.map((month) => month.month)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(document.pages[1]?.months.map((month) => month.month)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(document.pages[0]?.locationLabel).toBe('Rathenow, Berliner Str. 12');

    const january = document.pages[0]?.months[0];
    const october = document.pages[1]?.months[3];
    expect(
      january?.days.find((day) => day.dayOfMonth === 14)?.entries.map((entry) => entry.code)
    ).toEqual(['HM']);
    expect(january?.days.find((day) => day.dayOfMonth === 14)?.entries[0]?.isShifted).toBe(true);
    expect(january?.days.find((day) => day.dayOfMonth === 15)?.entries).toHaveLength(2);
    expect(october?.days.find((day) => day.dayOfMonth === 3)?.holidayLabel).toBe(
      'Tag der Deutschen Einheit'
    );
    expect(document.pages[0]?.hasShiftedPickups).toBe(true);
    expect(document.pages[0]?.fractionLegend.map((entry) => entry.label)).toEqual([
      'Bioabfall',
      'Hausmuell',
      'Leichtverpackungen',
      'Papier und Pappe',
    ]);
    expect(document.pages[0]?.hints.map((hint) => hint.label)).toEqual(['Tour: Nord']);
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

  it('declares the Windows ANSI encoding used for German umlauts', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Bärensprung',
        pickups: [],
      })
    ).toString('latin1');

    expect(pdfText).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(pdfText).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    expect(pdfText).toContain('(Bärensprung) Tj');
  });

  it('encodes Windows ANSI punctuation in imported pickup hints', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Bärensprung',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [
              {
                id: 'bio',
                label: 'Biogut',
                color: '#55AA33',
              },
            ],
          },
        ],
        legendHints: [
          { id: 'bio:1', label: '14.01.', description: '09:00–11:00 Uhr „bereitstellen“…' },
        ],
      })
    ).toString('latin1');
    const winAnsiDescription = `09:00${String.fromCharCode(0x96)}11:00 Uhr ${String.fromCharCode(
      0x84
    )}bereitstellen${String.fromCharCode(0x93)}${String.fromCharCode(0x85)}`;

    expect(pdfText).toContain(`14.01. - ${winAnsiDescription}`);
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

    expect(pdfText).toContain('1 0 0 1 38.00 487.23 Tm (01) Tj ET');
    expect(pdfText).toContain('1 0 0 1 58.00 487.23 Tm (Do) Tj ET');
  });

  it('uses a compact header and omits the redundant footer', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Rathenow, Berliner Str. 12',
        contactBlock: 'Abfallberatung\n03395 / 1234',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [{ id: 'hm', label: 'Hausmuell', shortLabel: 'HM', color: '#666666' }],
          },
        ],
        legendHints: [
          { id: 'tour:nord', label: 'Tour: Nord', description: 'Hinweis zur\nBereitstellung.' },
        ],
      })
    ).toString('latin1');

    expect(pdfText).toContain('/F2 20.00 Tf');
    expect(pdfText).toContain('/F1 10.50 Tf');
    expect(pdfText).toMatch(/1 0 0 1 38\.00 559\.28 Tm \(Abfallkalender 2026\) Tj ET/);
    expect(pdfText).toContain('(Tour: Nord - Hinweis zur Bereitstellung.) Tj ET');
    expect(pdfText).toContain('1 0 0 1 612.42 109.78 Tm (Abfallberatung 03395 / 1234) Tj ET');
    expect(pdfText).not.toContain('Abfallkalender 2026 · Rathenow');
    expect(pdfText).not.toContain('Abfallberatung · Beispielkontakt');
  });

  it('does not render legacy default notes or a footer', () => {
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

    expect(pdfText).not.toContain('Stand ');
    expect(pdfText).not.toContain('Alle wirksamen Fraktionen und Verschiebungen sind enthalten.');
    expect(pdfText).not.toContain('Abfallkalender 2026 · Rathenow');
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
          rgbData: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]),
        },
      })
    ).toString('latin1');

    expect(pdfText).toContain('/Subtype /Image');
    expect(pdfText).toContain('/XObject << /Im1');
    expect(pdfText).toContain('/Im1 Do');
    expect(pdfText).not.toContain('640.00 541.28 163.00 40.00 re f');
    expect(pdfText).not.toContain('640.00 541.28 163.00 40.00 re S');
  });

  it('renders fraction entries as vertical rows beneath the calendar', () => {
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
      const match = pdfText.match(
        new RegExp(`1 0 0 1 ([0-9.]+) ([0-9.]+) Tm \\(${label}\\) Tj ET`)
      );
      return match ? `${match[1]}:${match[2]}` : null;
    };

    const positions = Array.from({ length: 7 }, (_, index) =>
      extractLegendPosition(`Fraktion ${index + 1}`)
    );
    expect(positions.every((value) => value !== null)).toBe(true);
    expect(new Set(positions).size).toBe(7);
    const yPositions = positions.map((value) => value?.split(':')[1]);
    expect(new Set(yPositions).size).toBe(7);
    expect(pdfText).toContain('1 0 0 1 42.00 110.18 Tm (F1) Tj ET');
    expect(pdfText).toContain('1 0 0 1 68.00 109.78 Tm (Fraktion 1) Tj ET');
  });

  it('renders labels and wraps hints in the separate columns, omitting fraction descriptions', () => {
    const document = buildWasteCalendarPdfDocument({
      year: 2026,
      locationLabel: 'Bärensprung',
      pickups: [
        {
          date: '2026-01-14',
          fractions: [
            {
              id: 'bio',
              label: 'Biogut',
              description: 'Beschreibung der Abfallart',
              color: '#55AA33',
            },
          ],
        },
      ],
      legendHints: [
        {
          id: 'tour-bio',
          label: 'Tour: Bio',
          description:
            '<p>Mehr unter <a href="https://example.org">Hinweise</a>.</p>' +
            '<script>alert("xss")</script>',
        },
      ],
    });
    expect(document.pages[0]?.hints[0]).toMatchObject({
      label: 'Tour: Bio',
      description: 'Mehr unter Hinweise.',
    });

    const pdfText = renderWasteCalendarPdf(document).toString('latin1');
    expect(pdfText).toContain('1 0 0 1 68.00 109.78 Tm (Biogut) Tj ET');
    expect(pdfText).toContain('1 0 0 1 229.47 109.78 Tm (Tour: Bio - Mehr unter Hinweise.) Tj ET');
    expect(pdfText).not.toContain('Beschreibung der Abfallart');
  });

  it('uses the right quarter for contact only when a visible contact block is available', () => {
    const description = 'Abholung an der Hauptstraße. '.repeat(3) + 'Abholung am Bahnübergang.';
    const render = (contactBlock: string) =>
      renderWasteCalendarPdf(
        buildWasteCalendarPdfDocument({
          year: 2026,
          locationLabel: 'Bärensprung',
          pickups: [],
          legendHints: [{ id: 'stop', date: '2026-01-14', label: '14.01.', description }],
          contactBlock,
        })
      ).toString('latin1');

    const withoutContact = render('<p></p>');
    const withContact = render('Kontakt der Abfallberatung');

    expect(withoutContact).toContain(`(14.01. - ${description}) Tj ET`);
    expect(withContact).not.toContain(`(14.01. - ${description}) Tj ET`);
    expect(withContact).toContain('1 0 0 1 229.47 97.78 Tm (Abholung am Bahnübergang.) Tj ET');
    expect(withContact).toContain('1 0 0 1 612.42 109.78 Tm (Kontakt der Abfallberatung) Tj ET');
  });

  it('continues every hint in order after its half-year calendar when the first page fills', () => {
    const legendHints = Array.from({ length: 56 }, (_, index) => ({
      id: `stop:${index}`,
      date: '2026-09-08',
      label: '08.09.',
      description: `Haltepunkt Nr. ${index + 1}.`,
    }));
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Bad Wilsnack',
        pickups: [],
        legendHints,
      })
    ).toString('latin1');

    expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(4);
    expect(pdfText.match(/Fortsetzung zur Kalenderseite: Juli bis Dezember/g)).toHaveLength(2);
    expect(pdfText.indexOf('(Juli) Tj ET')).toBeLessThan(pdfText.indexOf('Haltepunkt Nr. 1.'));
    expect(
      Array.from(pdfText.matchAll(/Haltepunkt Nr\. (\d+)\./g), ([, index]) => Number(index))
    ).toEqual(legendHints.map((_, index) => index + 1));
  });

  it('renders shifted pickup markers outside their colored boxes and explains them below the legend', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Bärensprung',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [
              { id: 'hm', label: 'Hausmüll', shortLabel: 'HM', color: '#666666', isShifted: true },
              { id: 'ppk', label: 'Papier', shortLabel: 'PPK', color: '#58BCE5' },
            ],
          },
        ],
      })
    ).toString('latin1');

    expect(pdfText).toContain('76.00 330.58 18.00 9.50 re f');
    expect(pdfText).toContain('/F2 8.00 Tf 0.780 0.050 0.050 rg 1 0 0 1 96.00 331.48 Tm (*) Tj ET');
    expect(pdfText).toContain('103.00 330.58 22.00 9.50 re f');
    expect(pdfText).toContain('/F2 9.00 Tf 0.780 0.050 0.050 rg 1 0 0 1 38.00 109.28 Tm (*) Tj ET');
    expect(pdfText).toContain('1 0 0 1 50.00 109.78 Tm (= Ausweichtermin) Tj ET');
  });

  it('uses contrasting text for colored calendar labels and their legend entries', () => {
    const pdfText = renderWasteCalendarPdf(
      buildWasteCalendarPdfDocument({
        year: 2026,
        locationLabel: 'Bärensprung',
        pickups: [
          {
            date: '2026-01-14',
            fractions: [
              { id: 'dark', label: 'Dunkel', shortLabel: 'D', color: '#111111' },
              { id: 'light', label: 'Hell', shortLabel: 'H', color: '#EEEEEE' },
            ],
          },
        ],
      })
    ).toString('latin1');

    expect(pdfText).toMatch(
      /\/F1 7\.50 Tf 1\.000 1\.000 1\.000 rg 1 0 0 1 [\d.]+ [\d.]+ Tm \(D\) Tj ET/
    );
    expect(pdfText).toMatch(
      /\/F1 7\.50 Tf 0\.000 0\.000 0\.000 rg 1 0 0 1 [\d.]+ [\d.]+ Tm \(H\) Tj ET/
    );
    expect(pdfText).toMatch(
      /\/F1 7\.20 Tf 1\.000 1\.000 1\.000 rg 1 0 0 1 [\d.]+ [\d.]+ Tm \(D\) Tj ET/
    );
    expect(pdfText).toMatch(
      /\/F1 7\.20 Tf 0\.000 0\.000 0\.000 rg 1 0 0 1 [\d.]+ [\d.]+ Tm \(H\) Tj ET/
    );
  });
});
