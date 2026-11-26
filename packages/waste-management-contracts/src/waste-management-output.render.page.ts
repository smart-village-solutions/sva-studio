import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';
import {
  BRANDING_BOX,
  buildBrandingImageCommand,
  getContrastingTextColor,
  getHelveticaTextWidth,
  truncateHelveticaText,
  wrapHelveticaText,
} from './waste-management-output.render.helpers.js';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  SHIFT_MARKER_COLOR,
  drawText,
  drawFilledRectangle,
  drawStrokedRectangle,
} from './waste-management-output.render.drawing.js';
import { renderMonthGrid } from './waste-management-output.render.grid.js';

type CalendarPage = WasteCalendarPdfDocument['pages'][number];

type DetailRow = (commands: string[], rowTop: number) => void;

const MARGIN = 38;
const DETAILS_TOP = 476;
const CONTINUATION_TOP = 76;
const ROW_HEIGHT = 12;
const FONT_SIZE = 8;
const COLUMN_GAP = 10;

const renderHeader = (
  commands: string[],
  page: WasteCalendarPdfDocument['pages'][number],
  imageObjectName?: string
): void => {
  drawText({ commands, x: 38, top: 16, fontSize: 20, text: page.title, fontName: 'F2' });
  drawText({ commands, x: 38, top: 44, fontSize: 10.5, text: page.locationLabel, fontName: 'F1' });
  if (page.brandingImage && imageObjectName) {
    commands.push(buildBrandingImageCommand(page, imageObjectName, PAGE_HEIGHT) ?? '');
    return;
  }
  drawFilledRectangle(
    {
      commands,
      x: BRANDING_BOX.x,
      top: BRANDING_BOX.top,
      width: BRANDING_BOX.width,
      height: BRANDING_BOX.height,
    },
    [0.93, 0.95, 0.98]
  );
  drawStrokedRectangle(
    {
      commands,
      x: BRANDING_BOX.x,
      top: BRANDING_BOX.top,
      width: BRANDING_BOX.width,
      height: BRANDING_BOX.height,
    },
    [0.55, 0.62, 0.7],
    1
  );
  const placeholderLabel = truncateHelveticaText(
    page.brandingPlaceholderLabel,
    11,
    BRANDING_BOX.width - BRANDING_BOX.padding * 2
  );
  drawText({
    commands,
    x: BRANDING_BOX.x + (BRANDING_BOX.width - getHelveticaTextWidth(placeholderLabel, 11)) / 2,
    top: BRANDING_BOX.top + (BRANDING_BOX.height - 11) / 2 + 1,
    fontSize: 11,
    text: placeholderLabel,
    fontName: 'F1',
  });
};

const textRow =
  (x: number, text: string): DetailRow =>
  (commands, rowTop) =>
    drawText({
      commands,
      x,
      top: rowTop + 1.5,
      fontSize: FONT_SIZE,
      text,
      fontName: 'F1',
    });

const buildLegendRows = (page: CalendarPage, width: number): DetailRow[] => {
  const rows: DetailRow[] = [];
  const boxWidth = 22;
  const labelIndent = boxWidth + 8;
  const labelX = MARGIN + labelIndent;
  if (page.hasShiftedPickups) {
    rows.push((commands, rowTop) => {
      drawText({
        commands,
        x: MARGIN,
        top: rowTop + 1,
        fontSize: 9,
        text: '*',
        fontName: 'F2',
        color: SHIFT_MARKER_COLOR,
      });
      textRow(MARGIN + 12, `= ${page.shiftedPickupLabel}`)(commands, rowTop);
    });
  }

  for (const entry of page.fractionLegend) {
    const [firstLine = '', ...moreLines] = wrapHelveticaText(
      entry.label,
      FONT_SIZE,
      width - labelIndent
    );
    rows.push((commands, rowTop) => {
      drawFilledRectangle(
        { commands, x: MARGIN, top: rowTop + 0.8, width: boxWidth, height: 10.4 },
        entry.fillColor
      );
      drawText({
        commands,
        x: MARGIN + 4,
        top: rowTop + 1.9,
        fontSize: 7.2,
        text: entry.code,
        fontName: 'F1',
        color: getContrastingTextColor(entry.fillColor),
      });
      textRow(labelX, firstLine)(commands, rowTop);
    });
    rows.push(...moreLines.map((line) => textRow(labelX, line)));
  }
  return rows;
};

const buildDetailColumns = (page: CalendarPage): readonly DetailRow[][] => {
  const quarterWidth = (PAGE_WIDTH - 2 * MARGIN) / 4;
  const hintsX = MARGIN + quarterWidth;
  const hintsWidth = page.contactBlock ? 2 * quarterWidth - COLUMN_GAP : 3 * quarterWidth;
  const hintRows = page.hints.flatMap(({ label, description }) =>
    wrapHelveticaText(`${label} - ${description}`, FONT_SIZE, hintsWidth).map((line) =>
      textRow(hintsX, line)
    )
  );
  const columns = [buildLegendRows(page, quarterWidth - COLUMN_GAP), hintRows];
  if (page.contactBlock) {
    const contactX = MARGIN + 3 * quarterWidth;
    columns.push(
      wrapHelveticaText(page.contactBlock, FONT_SIZE, quarterWidth).map((line) =>
        textRow(contactX, line)
      )
    );
  }
  return columns;
};

export const renderPageCommands = (page: CalendarPage, imageObjectName?: string): string[] => {
  const columns = buildDetailColumns(page);
  const totalRows = Math.max(...columns.map((column) => column.length));
  const pageCommands: string[] = [];
  let offset = 0;
  do {
    const commands: string[] = [];
    drawFilledRectangle(
      { commands, x: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
      [1, 1, 1]
    );
    renderHeader(commands, page, imageObjectName);
    const rowTop = offset === 0 ? DETAILS_TOP : CONTINUATION_TOP;
    if (offset === 0) {
      renderMonthGrid(commands, page);
    } else {
      drawText({
        commands,
        x: MARGIN,
        top: 60,
        fontSize: 9,
        text: page.continuationLabel,
        fontName: 'F2',
      });
    }
    const capacity = Math.floor((PAGE_HEIGHT - 20 - rowTop) / ROW_HEIGHT);
    for (const column of columns) {
      column.slice(offset, offset + capacity).forEach((drawRow, index) => {
        drawRow(commands, rowTop + index * ROW_HEIGHT);
      });
    }
    pageCommands.push(commands.join('\n'));
    offset += capacity;
  } while (offset < totalRows);
  return pageCommands;
};
