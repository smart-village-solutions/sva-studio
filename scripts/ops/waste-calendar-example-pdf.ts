import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getEntryLabelWidth,
  getHolidayRenderLabel,
  LEGEND_ORDER,
  MONTH_NAMES,
  resolveEntriesForDate,
  resolveHolidayLabel,
  splitLegendLabel,
  WEEKDAY_SHORT_NAMES,
  YEAR,
  type RgbColor,
  type WasteCalendarDocument,
  type WasteCalendarMonth,
  type WasteCalendarPage,
} from './waste-calendar-example-pdf.shared.ts';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const OUTPUT_PATH = resolve(
  fileURLToPath(new URL('../../output/pdf/waste-calendar-example-2026.pdf', import.meta.url))
);
export type { WasteCalendarMonth } from './waste-calendar-example-pdf.shared.ts';

export function buildWasteCalendarDocument(): WasteCalendarDocument {
  return {
    year: YEAR,
    pages: [
      buildHalfYearPage([1, 2, 3, 4, 5, 6], [
        'Schadstoffmobil (Bitte beachten Sie auch die Zusatztermine an den Kleinannahmestellen):',
        'Do. 16.04., 13:00 bis 14:00 Uhr, Wittenberger Chaussee 1 / Zentraler Wertstoffcontainerplatz',
      ]),
      buildHalfYearPage([7, 8, 9, 10, 11, 12], [
        'Schadstoffmobil (Bitte beachten Sie auch die Zusatztermine an den Kleinannahmestellen):',
        'Do. 15.10., 13:00 bis 14:00 Uhr, Wittenberger Chaussee 1 / Zentraler Wertstoffcontainerplatz',
      ]),
    ],
  };
}

export function renderWasteCalendarPdf(document: WasteCalendarDocument): Buffer {
  const pdf = new PdfBuilder();
  const regularFontId = pdf.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = pdf.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesId = pdf.reserveObject();
  const pageIds: number[] = [];

  for (const page of document.pages) {
    const commands: string[] = [];
    renderPageBackground(commands);
    renderHeader(commands, page);
    renderMonthGrid(commands, page);
    renderNotes(commands, page);
    renderLegend(commands, page);
    renderFooter(commands, page);

    const streamId = pdf.addStreamObject(commands.join('\n'));
    const pageId = pdf.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
        2
      )}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  pdf.setReservedObject(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  );

  const rootId = pdf.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.build(rootId);
}

export function writeWasteCalendarExamplePdf(outputPath = OUTPUT_PATH): string {
  const pdf = renderWasteCalendarPdf(buildWasteCalendarDocument());
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, pdf);
  return outputPath;
}

function buildHalfYearPage(months: readonly number[], notes: readonly string[]): WasteCalendarPage {
  return {
    title: `Abfallkalender ${YEAR}`,
    locationLabel: 'Musterstadt, Ackerstrasse',
    brandingPlaceholderLabel: 'Logo / Bild',
    months: months.map((month) => buildMonth(YEAR, month)),
    legend: LEGEND_ORDER.map((entry) => ({
      code: entry.code,
      label: entry.label,
      fillColor: entry.fillColor,
    })),
    notes: [...notes],
    footerLine: 'Musterstadt · Berliner Str. 49 · 19348 Musterstadt · Tel. 03876 - 713-0 · service@example.test',
  };
}

function buildMonth(year: number, month: number): WasteCalendarMonth {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: WasteCalendarDay[] = [];

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
    const isoDate = toIsoDate(date);
    const weekdayIndex = normalizeWeekday(date.getUTCDay());
    const holidayLabel = resolveHolidayLabel(isoDate);
    const entries = resolveEntriesForDate(date);

    days.push({
      isoDate,
      dayOfMonth,
      weekdayShort: WEEKDAY_SHORT_NAMES[weekdayIndex],
      weekNumber: weekdayIndex === 0 ? getIsoWeekNumber(date) : null,
      holidayLabel,
      entries,
    });
  }

  return {
    month,
    label: MONTH_NAMES[month - 1],
    days,
  };
}

function renderPageBackground(commands: string[]): void {
  drawFilledRectangle(commands, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, [1, 1, 1]);
}

function renderHeader(commands: string[], page: WasteCalendarPage): void {
  drawText(commands, 38, 40, 30, page.title, 'F2');
  drawText(commands, 38, 92, 14, page.locationLabel, 'F1');
  drawFilledRectangle(commands, 665, 28, 138, 62, [0.83, 0.83, 0.83]);
  drawStrokedRectangle(commands, 665, 28, 138, 62, [0.65, 0.65, 0.65], 1);
  drawCenteredText(commands, 665, 28, 138, 62, 12, page.brandingPlaceholderLabel, 'F2');
}

function renderMonthGrid(commands: string[], page: WasteCalendarPage): void {
  const monthTop = 124;
  const monthLeft = 34;
  const monthWidth = 116;
  const monthGap = 18;
  const headerHeight = 20;
  const rowHeight = 12;
  const totalRows = 31;

  for (const [index, month] of page.months.entries()) {
    const x = monthLeft + index * (monthWidth + monthGap);

    drawFilledRectangle(commands, x, monthTop, monthWidth, headerHeight, [0.39, 0.78, 0.15]);
    drawStrokedRectangle(commands, x, monthTop, monthWidth, headerHeight, [0.15, 0.15, 0.15], 0.8);
    drawCenteredText(commands, x, monthTop, monthWidth, headerHeight, 11, month.label, 'F2', [1, 1, 1]);

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
      const rowTop = monthTop + headerHeight + rowIndex * rowHeight;
      const day = month.days[rowIndex] ?? null;
      const hasWeekend = day !== null && (day.weekdayShort === 'Sa' || day.weekdayShort === 'So');

      drawFilledRectangle(commands, x, rowTop, monthWidth, rowHeight, hasWeekend ? [0.69, 0.83, 0.92] : [1, 1, 1]);
      drawStrokedRectangle(commands, x, rowTop, monthWidth, rowHeight, [0.2, 0.2, 0.2], 0.45);

      if (day === null) {
        continue;
      }

      drawText(commands, x + 4, rowTop + 9.3, 8.5, pad2(day.dayOfMonth), 'F1');
      drawText(commands, x + 24, rowTop + 9.3, 8.5, day.weekdayShort, 'F1');

      if (day.weekNumber !== null) {
        drawText(commands, x - 12, rowTop + 9.3, 8, String(day.weekNumber), 'F1');
      }

      if (day.holidayLabel !== null) {
        drawText(commands, x + 42, rowTop + 9.2, 7.1, getHolidayRenderLabel(day.holidayLabel), 'F1');
      }

      let labelX = x + 42;
      const labelY = rowTop + 1.4;
      for (const entry of day.entries) {
        const labelWidth = getEntryLabelWidth(entry.code);
        drawFilledRectangle(commands, labelX, labelY, labelWidth, rowHeight - 2.5, entry.fillColor);
        drawText(commands, labelX + 3, rowTop + 9.2, 8.2, entry.code, 'F1');
        labelX += labelWidth + 2;
      }
    }
  }
}

function renderNotes(commands: string[], page: WasteCalendarPage): void {
  drawText(commands, 38, 525, 10.5, page.notes[0] ?? '', 'F1');
  drawText(commands, 38, 549, 10.5, page.notes[1] ?? '', 'F1');
}

function renderLegend(commands: string[], page: WasteCalendarPage): void {
  const legendLeft = 520;
  const legendTop = 518;
  const legendColumnGap = 140;
  const rowGap = 28;

  for (const [index, entry] of page.legend.entries()) {
    const columnIndex = index < 3 ? 0 : 1;
    const rowIndex = index % 3;
    const x = legendLeft + columnIndex * legendColumnGap;
    const y = legendTop + rowIndex * rowGap;
    drawFilledRectangle(commands, x, y, 22, 14, entry.fillColor);
    drawText(commands, x + 6, y + 10.2, 8.6, entry.code, 'F1');
    const labelLines = splitLegendLabel(entry.label);
    for (const [lineIndex, line] of labelLines.entries()) {
      drawText(commands, x + 30, y + 8.7 + lineIndex * 9, 8, line, 'F1');
    }
  }
}

function renderFooter(commands: string[], page: WasteCalendarPage): void {
  drawText(commands, 38, 582, 10.5, page.footerLine, 'F1');
}

function drawText(
  commands: string[],
  x: number,
  top: number,
  fontSize: number,
  text: string,
  fontName: 'F1' | 'F2',
  color: RgbColor = [0.15, 0.15, 0.15]
): void {
  const baselineY = PAGE_HEIGHT - top - fontSize;
  commands.push(
    `BT /${fontName} ${fontSize.toFixed(2)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(
      3
    )} rg 1 0 0 1 ${x.toFixed(2)} ${baselineY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`
  );
}

function drawCenteredText(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
  text: string,
  fontName: 'F1' | 'F2',
  color: RgbColor = [0.15, 0.15, 0.15]
): void {
  const estimatedWidth = text.length * fontSize * 0.48;
  const textX = x + (width - estimatedWidth) / 2;
  const textTop = top + (height - fontSize) / 2 + 1;
  drawText(commands, textX, textTop, fontSize, text, fontName, color);
}

function drawFilledRectangle(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  color: RgbColor
): void {
  const y = PAGE_HEIGHT - top - height;
  commands.push(
    `q ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(
      2
    )} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`
  );
}

function drawStrokedRectangle(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  color: RgbColor,
  lineWidth: number
): void {
  const y = PAGE_HEIGHT - top - height;
  commands.push(
    `q ${lineWidth.toFixed(2)} w ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG ${x.toFixed(
      2
    )} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`
  );
}

function normalizeWeekday(utcDay: number): number {
  return utcDay === 0 ? 6 : utcDay - 1;
}

function getIsoWeekNumber(date: Date): number {
  const target = new Date(date.getTime());
  const dayNumber = normalizeWeekday(target.getUTCDay()) + 1;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function escapePdfText(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

class PdfBuilder {
  private readonly objects: string[] = [];

  addObject(objectBody: string): number {
    this.objects.push(objectBody);
    return this.objects.length;
  }

  reserveObject(): number {
    this.objects.push('');
    return this.objects.length;
  }

  setReservedObject(objectId: number, objectBody: string): void {
    this.objects[objectId - 1] = objectBody;
  }

  addStreamObject(streamContent: string): number {
    const streamLength = Buffer.byteLength(streamContent, 'latin1');
    return this.addObject(`<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`);
  }

  build(rootObjectId: number): Buffer {
    let pdfText = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (const [index, objectBody] of this.objects.entries()) {
      offsets.push(Buffer.byteLength(pdfText, 'latin1'));
      pdfText += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
    }

    const xrefStart = Buffer.byteLength(pdfText, 'latin1');
    pdfText += `xref\n0 ${this.objects.length + 1}\n`;
    pdfText += '0000000000 65535 f \n';

    for (let objectId = 1; objectId <= this.objects.length; objectId += 1) {
      pdfText += `${offsets[objectId]?.toString().padStart(10, '0')} 00000 n \n`;
    }

    pdfText += `trailer\n<< /Size ${this.objects.length + 1} /Root ${rootObjectId} 0 R >>\n`;
    pdfText += `startxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdfText, 'latin1');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const writtenPath = writeWasteCalendarExamplePdf();
  process.stdout.write(`${writtenPath}\n`);
}
