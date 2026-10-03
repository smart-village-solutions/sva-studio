import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';
import {
  BRANDING_BOX,
  buildBrandingImageCommand,
  getContrastingTextColor,
  truncateHelveticaText,
} from './waste-management-output.render.helpers.js';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  SHIFT_MARKER_COLOR,
  drawText,
  drawCenteredText,
  drawFilledRectangle,
  drawStrokedRectangle,
} from './waste-management-output.render.drawing.js';
import { renderMonthGrid } from './waste-management-output.render.grid.js';

const renderHeader = (
  commands: string[],
  page: WasteCalendarPdfDocument['pages'][number],
  imageObjectName?: string
): void => {
  drawText({ commands, x: 38, top: 16, fontSize: 20, text: page.title, fontName: 'F2' });
  drawText({ commands, x: 38, top: 44, fontSize: 10.5, text: page.locationLabel, fontName: 'F1' });
  if (page.contactBlock) {
    drawText({
      commands,
      x: 38,
      top: 60,
      fontSize: 7.5,
      text: truncateHelveticaText(page.contactBlock, 7.5, 570),
      fontName: 'F1',
    });
  }
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

const renderLegend = (
  commands: string[],
  page: WasteCalendarPdfDocument['pages'][number]
): void => {
  const baseX = 38;
  const baseY = 476;
  const boxWidth = 22;
  const rowHeight = 12;
  const labelX = baseX + boxWidth + 8;
  const rightEdge = PAGE_WIDTH - baseX;
  const fontSize = 8;

  for (const [index, entry] of page.legend.entries()) {
    const rowTop = baseY + index * rowHeight;
    if (entry.kind === 'shift') {
      drawText({
        commands,
        x: baseX,
        top: rowTop + 1,
        fontSize: 9,
        text: '*',
        fontName: 'F2',
        color: SHIFT_MARKER_COLOR,
      });
      drawText({
        commands,
        x: baseX + 12,
        top: rowTop + 1.5,
        fontSize,
        text: entry.label,
        fontName: 'F1',
      });
      continue;
    }

    if (entry.kind === 'fraction') {
      drawFilledRectangle(
        { commands, x: baseX, top: rowTop + 0.8, width: boxWidth, height: 10.4 },
        entry.fillColor
      );
      drawText({
        commands,
        x: baseX + 4,
        top: rowTop + 1.9,
        fontSize: 7.2,
        text: entry.code,
        fontName: 'F1',
        color: getContrastingTextColor(entry.fillColor),
      });
      drawText({
        commands,
        x: labelX,
        top: rowTop + 1.5,
        fontSize,
        text: truncateHelveticaText(
          entry.description ? `${entry.label} - ${entry.description}` : entry.label,
          fontSize,
          rightEdge - labelX
        ),
        fontName: 'F1',
      });
      continue;
    }

    drawText({
      commands,
      x: baseX,
      top: rowTop + 1.5,
      fontSize,
      text: truncateHelveticaText(
        `${entry.label} - ${entry.description}`,
        fontSize,
        rightEdge - baseX
      ),
      fontName: 'F1',
    });
  }
};

export const renderPageCommands = (
  page: WasteCalendarPdfDocument['pages'][number],
  imageObjectName?: string
): string => {
  const commands: string[] = [];
  drawFilledRectangle(
    { commands, x: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
    [1, 1, 1]
  );
  renderHeader(commands, page, imageObjectName);
  renderMonthGrid(commands, page);
  renderLegend(commands, page);
  return commands.join('\n');
};
