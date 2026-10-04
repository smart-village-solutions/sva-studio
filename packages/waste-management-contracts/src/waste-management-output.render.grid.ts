import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';
import {
  abbreviateHolidayLabel,
  getContrastingTextColor,
  getEntryLabelWidth,
  pad2,
} from './waste-management-output.render.helpers.js';
import {
  drawText,
  drawCenteredText,
  drawFilledRectangle,
  drawStrokedRectangle,
  SHIFT_MARKER_ADVANCE,
  SHIFT_MARKER_COLOR,
} from './waste-management-output.render.drawing.js';

export const renderMonthGrid = (
  commands: string[],
  page: WasteCalendarPdfDocument['pages'][number]
): void => {
  const monthTop = 78;
  const monthLeft = 34;
  const monthWidth = 116;
  const monthGap = 18;
  const headerHeight = 20;
  const rowHeight = 12;

  for (const [index, month] of page.months.entries()) {
    const x = monthLeft + index * (monthWidth + monthGap);
    drawFilledRectangle(
      { commands, x, top: monthTop, width: monthWidth, height: headerHeight },
      [0.16, 0.47, 0.74]
    );
    drawStrokedRectangle(
      { commands, x, top: monthTop, width: monthWidth, height: headerHeight },
      [0.15, 0.15, 0.15],
      0.8
    );
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
      renderMonthDay({
        commands,
        day: month.days[rowIndex] ?? null,
        rowHeight,
        rowTop: monthTop + headerHeight + rowIndex * rowHeight,
        width: monthWidth,
        x,
      });
    }
  }
};

const renderMonthDay = (
  input: Readonly<{
    commands: string[];
    day: WasteCalendarPdfDocument['pages'][number]['months'][number]['days'][number] | null;
    rowHeight: number;
    rowTop: number;
    width: number;
    x: number;
  }>
): void => {
  const { commands, day, rowHeight, rowTop, width, x } = input;
  const hasWeekend = day !== null && (day.weekdayShort === 'Sa' || day.weekdayShort === 'So');
  drawFilledRectangle(
    { commands, x, top: rowTop, width, height: rowHeight },
    hasWeekend ? [0.94, 0.96, 0.99] : [1, 1, 1]
  );
  drawStrokedRectangle(
    { commands, x, top: rowTop, width, height: rowHeight },
    [0.2, 0.2, 0.2],
    0.45
  );

  if (day === null) {
    return;
  }

  const centeredTextTop = (fontSize: number): number => rowTop + (rowHeight - fontSize) / 2 - 0.2;
  renderDayMetadata({ commands, centeredTextTop, day, x });
  renderDayEntries({ commands, centeredTextTop, day, rowHeight, rowTop, x });
};

type CalendarDay = WasteCalendarPdfDocument['pages'][number]['months'][number]['days'][number];

const renderDayMetadata = (
  input: Readonly<{
    centeredTextTop: (fontSize: number) => number;
    commands: string[];
    day: CalendarDay;
    x: number;
  }>
): void => {
  const { centeredTextTop, commands, day, x } = input;
  const dayTextTop = centeredTextTop(8.5);
  drawText({
    commands,
    x: x + 4,
    top: dayTextTop,
    fontSize: 8.5,
    text: pad2(day.dayOfMonth),
    fontName: 'F1',
  });
  drawText({
    commands,
    x: x + 24,
    top: dayTextTop,
    fontSize: 8.5,
    text: day.weekdayShort,
    fontName: 'F1',
  });

  if (day.weekNumber !== null) {
    drawText({
      commands,
      x: x - 12,
      top: centeredTextTop(8),
      fontSize: 8,
      text: String(day.weekNumber),
      fontName: 'F1',
    });
  }
  if (day.holidayLabel !== null) {
    drawText({
      commands,
      x: x + 42,
      top: centeredTextTop(6.8),
      fontSize: 6.8,
      text: abbreviateHolidayLabel(day.holidayLabel),
      fontName: 'F1',
    });
  }
};

const renderDayEntries = (
  input: Readonly<{
    centeredTextTop: (fontSize: number) => number;
    commands: string[];
    day: CalendarDay;
    rowHeight: number;
    rowTop: number;
    x: number;
  }>
): void => {
  const { centeredTextTop, commands, day, rowHeight, rowTop, x } = input;
  let labelX = x + 42;
  for (const entry of day.entries) {
    const labelWidth = getEntryLabelWidth(entry.code);
    drawFilledRectangle(
      { commands, x: labelX, top: rowTop + 1.2, width: labelWidth, height: rowHeight - 2.5 },
      entry.fillColor
    );
    drawText({
      commands,
      x: labelX + 2.8,
      top: centeredTextTop(7.5),
      fontSize: 7.5,
      text: entry.code,
      fontName: 'F1',
      color: getContrastingTextColor(entry.fillColor),
    });
    if (entry.isShifted) {
      drawText({
        commands,
        x: labelX + labelWidth + 2,
        top: centeredTextTop(8),
        fontSize: 8,
        text: '*',
        fontName: 'F2',
        color: SHIFT_MARKER_COLOR,
      });
    }
    labelX += labelWidth + 2 + (entry.isShifted ? SHIFT_MARKER_ADVANCE : 0);
  }
};
