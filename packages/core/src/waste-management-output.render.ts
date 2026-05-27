import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';
import { PdfBuilder } from './waste-management-output.pdf-builder.js';

type RgbColor = readonly [red: number, green: number, blue: number];

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

const splitLegendLabel = (label: string): readonly string[] => {
  if (label.length <= 24) {
    return [label];
  }

  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > 24 && current.length > 0) {
      lines.push(current);
      current = word;
      continue;
    }
    current = next;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
};

const pad2 = (value: number): string => value.toString().padStart(2, '0');

const abbreviateHolidayLabel = (label: string): string => {
  switch (label) {
    case 'Christi Himmelfahrt':
      return 'Christi Himmelf.';
    case 'Tag der Deutschen Einheit':
      return 'Tag d. Dt. Einheit';
    default:
      return label;
  }
};

const getEntryLabelWidth = (code: string): number => {
  if (code.length <= 2) {
    return 18;
  }
  if (code.length === 3) {
    return 22;
  }
  return 26;
};

const drawText = (
  commands: string[],
  x: number,
  top: number,
  fontSize: number,
  text: string,
  fontName: 'F1' | 'F2',
  color: RgbColor = [0.15, 0.15, 0.15]
): void => {
  const baselineY = PAGE_HEIGHT - top - fontSize;
  commands.push(
    `BT /${fontName} ${fontSize.toFixed(2)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(
      3
    )} rg 1 0 0 1 ${x.toFixed(2)} ${baselineY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`
  );
};

const drawCenteredText = (
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
  text: string,
  fontName: 'F1' | 'F2',
  color: RgbColor = [0.15, 0.15, 0.15]
): void => {
  const estimatedWidth = text.length * fontSize * 0.48;
  const textX = x + (width - estimatedWidth) / 2;
  const textTop = top + (height - fontSize) / 2 + 1;
  drawText(commands, textX, textTop, fontSize, text, fontName, color);
};

const drawFilledRectangle = (
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  fillColor: RgbColor
): void => {
  const y = PAGE_HEIGHT - top - height;
  commands.push(
    `${fillColor[0].toFixed(3)} ${fillColor[1].toFixed(3)} ${fillColor[2].toFixed(3)} rg ${x.toFixed(
      2
    )} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`
  );
};

const drawStrokedRectangle = (
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  strokeColor: RgbColor,
  lineWidth: number
): void => {
  const y = PAGE_HEIGHT - top - height;
  commands.push(
    `${lineWidth.toFixed(2)} w ${strokeColor[0].toFixed(3)} ${strokeColor[1].toFixed(3)} ${strokeColor[2].toFixed(
      3
    )} RG ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`
  );
};

const renderHeader = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  drawText(commands, 38, 40, 30, page.title, 'F2');
  drawText(commands, 38, 92, 14, page.locationLabel, 'F1');
  drawFilledRectangle(commands, 640, 28, 163, 62, [0.93, 0.95, 0.98]);
  drawStrokedRectangle(commands, 640, 28, 163, 62, [0.55, 0.62, 0.7], 1);
  drawCenteredText(commands, 640, 28, 163, 62, 11, page.brandingPlaceholderLabel, 'F2');
};

const renderMonthGrid = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  const monthTop = 124;
  const monthLeft = 34;
  const monthWidth = 116;
  const monthGap = 18;
  const headerHeight = 20;
  const rowHeight = 12;

  for (const [index, month] of page.months.entries()) {
    const x = monthLeft + index * (monthWidth + monthGap);
    drawFilledRectangle(commands, x, monthTop, monthWidth, headerHeight, [0.16, 0.47, 0.74]);
    drawStrokedRectangle(commands, x, monthTop, monthWidth, headerHeight, [0.15, 0.15, 0.15], 0.8);
    drawCenteredText(commands, x, monthTop, monthWidth, headerHeight, 11, month.label, 'F2', [1, 1, 1]);

    for (let rowIndex = 0; rowIndex < 31; rowIndex += 1) {
      const rowTop = monthTop + headerHeight + rowIndex * rowHeight;
      const day = month.days[rowIndex] ?? null;
      const hasWeekend = day !== null && (day.weekdayShort === 'Sa' || day.weekdayShort === 'So');
      drawFilledRectangle(commands, x, rowTop, monthWidth, rowHeight, hasWeekend ? [0.94, 0.96, 0.99] : [1, 1, 1]);
      drawStrokedRectangle(commands, x, rowTop, monthWidth, rowHeight, [0.2, 0.2, 0.2], 0.45);

      if (day === null) {
        continue;
      }

      const dayTextTop = rowTop + 1.6;
      drawText(commands, x + 4, dayTextTop, 8.5, pad2(day.dayOfMonth), 'F1');
      drawText(commands, x + 24, dayTextTop, 8.5, day.weekdayShort, 'F1');

      if (day.weekNumber !== null) {
        drawText(commands, x - 12, dayTextTop, 8, String(day.weekNumber), 'F1');
      }
      if (day.holidayLabel !== null) {
        drawText(commands, x + 42, rowTop + 2.1, 6.8, abbreviateHolidayLabel(day.holidayLabel), 'F1');
      }

      let labelX = x + 42;
      for (const entry of day.entries) {
        const labelWidth = getEntryLabelWidth(entry.code);
        drawFilledRectangle(commands, labelX, rowTop + 1.2, labelWidth, rowHeight - 2.5, entry.fillColor);
        drawText(commands, labelX + 2.8, rowTop + 1.8, 7.5, entry.code, 'F1');
        labelX += labelWidth + 2;
      }
    }
  }
};

const renderNotes = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  drawText(commands, 38, 525, 10.2, page.notes[0] ?? '', 'F1');
  drawText(commands, 38, 549, 10.2, page.notes[1] ?? '', 'F1');
};

const renderLegend = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  const rowsPerColumn = 4;
  const columnWidth = 118;
  const baseX = 446;
  const baseY = 486;
  const rowGap = 22;

  for (const [index, entry] of page.legend.entries()) {
    const columnIndex = Math.floor(index / rowsPerColumn);
    const rowIndex = index % rowsPerColumn;
    const x = baseX + columnIndex * columnWidth;
    const y = baseY + rowIndex * rowGap;
    drawFilledRectangle(commands, x, y, 22, 14, entry.fillColor);
    drawText(commands, x + 4, y + 10.2, 7.8, entry.code, 'F1');
    for (const [lineIndex, line] of splitLegendLabel(entry.label).entries()) {
      drawText(commands, x + 30, y + 8.7 + lineIndex * 9, 8, line, 'F1');
    }
  }
};

const renderFooter = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  drawText(commands, 38, 582, 9.6, page.footerLine, 'F1');
};

const renderPageCommands = (page: WasteCalendarPdfDocument['pages'][number]): string => {
  const commands: string[] = [];
  drawFilledRectangle(commands, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, [1, 1, 1]);
  renderHeader(commands, page);
  renderMonthGrid(commands, page);
  renderNotes(commands, page);
  renderLegend(commands, page);
  renderFooter(commands, page);
  return commands.join('\n');
};

const escapePdfText = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

export const renderWasteCalendarPdf = (document: WasteCalendarPdfDocument): Buffer => {
  const pdf = new PdfBuilder();
  const regularFontId = pdf.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = pdf.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesId = pdf.reserveObject();
  const pageIds = document.pages.map((page) => {
    const streamId = pdf.addStreamObject(renderPageCommands(page));
    return pdf.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
        2
      )}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`
    );
  });

  pdf.setReservedObject(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  );
  return pdf.build(pdf.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
};
