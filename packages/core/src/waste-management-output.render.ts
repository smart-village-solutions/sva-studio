import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';
import { PdfBuilder } from './waste-management-output.pdf-builder.js';
import {
  abbreviateHolidayLabel,
  BRANDING_BOX,
  buildBrandingImageCommand,
  createBrandingImageResource,
  getEntryLabelWidth,
  pad2,
  splitLegendLabel,
  type RgbColor,
} from './waste-management-output.render.helpers.js';
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

type TextDrawInput = Readonly<{
  color?: RgbColor;
  commands: string[];
  fontName: 'F1' | 'F2';
  fontSize: number;
  text: string;
  top: number;
  x: number;
}>;

type CenteredTextDrawInput = Readonly<{
  color?: RgbColor;
  commands: string[];
  fontName: 'F1' | 'F2';
  fontSize: number;
  height: number;
  text: string;
  top: number;
  width: number;
  x: number;
}>;

type RectangleDrawInput = Readonly<{
  commands: string[];
  height: number;
  top: number;
  width: number;
  x: number;
}>;

const drawText = ({ commands, x, top, fontSize, text, fontName, color = [0.15, 0.15, 0.15] }: TextDrawInput): void => {
  const baselineY = PAGE_HEIGHT - top - fontSize;
  commands.push(
    `BT /${fontName} ${fontSize.toFixed(2)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(
      3
    )} rg 1 0 0 1 ${x.toFixed(2)} ${baselineY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`
  );
};

const drawCenteredText = ({
  commands,
  x,
  top,
  width,
  height,
  fontSize,
  text,
  fontName,
  color = [0.15, 0.15, 0.15],
}: CenteredTextDrawInput): void => {
  const estimatedWidth = text.length * fontSize * 0.48;
  const textX = x + (width - estimatedWidth) / 2;
  const textTop = top + (height - fontSize) / 2 + 1;
  drawText({ commands, x: textX, top: textTop, fontSize, text, fontName, color });
};

const drawFilledRectangle = (
  { commands, x, top, width, height }: RectangleDrawInput,
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
  { commands, x, top, width, height }: RectangleDrawInput,
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
const renderHeader = (
  commands: string[],
  page: WasteCalendarPdfDocument['pages'][number],
  imageObjectName?: string
): void => {
  drawText({ commands, x: 38, top: 40, fontSize: 30, text: page.title, fontName: 'F2' });
  drawText({ commands, x: 38, top: 92, fontSize: 14, text: page.locationLabel, fontName: 'F1' });
  drawFilledRectangle({ commands, x: BRANDING_BOX.x, top: BRANDING_BOX.top, width: BRANDING_BOX.width, height: BRANDING_BOX.height }, [0.93, 0.95, 0.98]);
  drawStrokedRectangle({ commands, x: BRANDING_BOX.x, top: BRANDING_BOX.top, width: BRANDING_BOX.width, height: BRANDING_BOX.height }, [0.55, 0.62, 0.7], 1);
  if (page.brandingImage && imageObjectName) {
    commands.push(buildBrandingImageCommand(page, imageObjectName, PAGE_HEIGHT) ?? '');
    return;
  }
  drawCenteredText({
    commands,
    x: BRANDING_BOX.x,
    top: BRANDING_BOX.top,
    width: BRANDING_BOX.width,
    height: BRANDING_BOX.height,
    fontSize: 11,
    text: page.brandingPlaceholderLabel,
    fontName: 'F2',
  });
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
    drawFilledRectangle({ commands, x, top: monthTop, width: monthWidth, height: headerHeight }, [0.16, 0.47, 0.74]);
    drawStrokedRectangle({ commands, x, top: monthTop, width: monthWidth, height: headerHeight }, [0.15, 0.15, 0.15], 0.8);
    drawCenteredText({
      commands,
      x,
      top: monthTop,
      width: monthWidth,
      height: headerHeight,
      fontSize: 11,
      text: month.label,
      fontName: 'F2',
      color: [1, 1, 1],
    });

    for (let rowIndex = 0; rowIndex < 31; rowIndex += 1) {
      const rowTop = monthTop + headerHeight + rowIndex * rowHeight;
      const day = month.days[rowIndex] ?? null;
      const hasWeekend = day !== null && (day.weekdayShort === 'Sa' || day.weekdayShort === 'So');
      drawFilledRectangle({ commands, x, top: rowTop, width: monthWidth, height: rowHeight }, hasWeekend ? [0.94, 0.96, 0.99] : [1, 1, 1]);
      drawStrokedRectangle({ commands, x, top: rowTop, width: monthWidth, height: rowHeight }, [0.2, 0.2, 0.2], 0.45);

      if (day === null) {
        continue;
      }

      const dayTextTop = rowTop + 1.6;
      drawText({ commands, x: x + 4, top: dayTextTop, fontSize: 8.5, text: pad2(day.dayOfMonth), fontName: 'F1' });
      drawText({ commands, x: x + 24, top: dayTextTop, fontSize: 8.5, text: day.weekdayShort, fontName: 'F1' });

      if (day.weekNumber !== null) {
        drawText({ commands, x: x - 12, top: dayTextTop, fontSize: 8, text: String(day.weekNumber), fontName: 'F1' });
      }
      if (day.holidayLabel !== null) {
        drawText({
          commands,
          x: x + 42,
          top: rowTop + 2.1,
          fontSize: 6.8,
          text: abbreviateHolidayLabel(day.holidayLabel),
          fontName: 'F1',
        });
      }

      let labelX = x + 42;
      for (const entry of day.entries) {
        const labelWidth = getEntryLabelWidth(entry.code);
        drawFilledRectangle({ commands, x: labelX, top: rowTop + 1.2, width: labelWidth, height: rowHeight - 2.5 }, entry.fillColor);
        drawText({ commands, x: labelX + 2.8, top: rowTop + 1.8, fontSize: 7.5, text: entry.code, fontName: 'F1' });
        labelX += labelWidth + 2;
      }
    }
  }
};

const renderNotes = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  for (const [index, note] of page.notes.slice(0, 4).entries()) {
    drawText({ commands, x: 38, top: 501 + index * 16, fontSize: 10.2, text: note, fontName: 'F1' });
  }
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
    drawFilledRectangle({ commands, x, top: y, width: 22, height: 14 }, entry.fillColor);
    drawText({ commands, x: x + 4, top: y + 10.2, fontSize: 7.8, text: entry.code, fontName: 'F1' });
    for (const [lineIndex, line] of splitLegendLabel(entry.label).entries()) {
      drawText({ commands, x: x + 30, top: y + 8.7 + lineIndex * 9, fontSize: 8, text: line, fontName: 'F1' });
    }
  }
};

const renderFooter = (commands: string[], page: WasteCalendarPdfDocument['pages'][number]): void => {
  drawText({ commands, x: 38, top: 582, fontSize: 9.6, text: page.footerLine, fontName: 'F1' });
};

const renderPageCommands = (
  page: WasteCalendarPdfDocument['pages'][number],
  imageObjectName?: string
): string => {
  const commands: string[] = [];
  drawFilledRectangle({ commands, x: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT }, [1, 1, 1]);
  renderHeader(commands, page, imageObjectName);
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
  const brandingImageResource = createBrandingImageResource({
    document,
    addStreamObject: (streamContent, dictionary) => pdf.addStreamObject(streamContent, dictionary),
  });
  const pageIds = document.pages.map((page) => {
    const streamId = pdf.addStreamObject(renderPageCommands(page, brandingImageResource?.objectName));
    const xObjectSection = brandingImageResource
      ? ` /XObject << /${brandingImageResource.objectName} ${brandingImageResource.id} 0 R >>`
      : '';
    return pdf.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
        2
      )}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>${xObjectSection} >> /Contents ${streamId} 0 R >>`
    );
  });

  pdf.setReservedObject(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  );
  return pdf.build(pdf.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
};
