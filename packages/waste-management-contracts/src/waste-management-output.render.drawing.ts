import { escapePdfText } from './waste-management-output.encoding.js';
import type { RgbColor } from './waste-management-output.render.helpers.js';

export const PAGE_WIDTH = 841.89;
export const PAGE_HEIGHT = 595.28;
export const SHIFT_MARKER_COLOR: RgbColor = [0.78, 0.05, 0.05];
export const SHIFT_MARKER_ADVANCE = 7;

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

export const drawText = ({
  commands,
  x,
  top,
  fontSize,
  text,
  fontName,
  color = [0.15, 0.15, 0.15],
}: TextDrawInput): void => {
  const baselineY = PAGE_HEIGHT - top - fontSize;
  commands.push(
    `BT /${fontName} ${fontSize.toFixed(2)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(
      3
    )} rg 1 0 0 1 ${x.toFixed(2)} ${baselineY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`
  );
};

export const drawCenteredText = ({
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

export const drawFilledRectangle = (
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

export const drawStrokedRectangle = (
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
