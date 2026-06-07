import sharp from 'sharp';
import type { WasteCalendarPdfBrandingImage } from '@sva/core/waste-output';

const BRANDING_TARGET_WIDTH = 326;
const BRANDING_TARGET_HEIGHT = 124;

export const loadPublicWastePdfBrandingImage = async (
  assetUrl: string
): Promise<WasteCalendarPdfBrandingImage | undefined> => {
  const response = await fetch(assetUrl).catch(() => null);
  if (!response?.ok) {
    return undefined;
  }

  const assetBuffer = Buffer.from(await response.arrayBuffer());
  const rendered = await sharp(assetBuffer, { density: 288 })
    .resize({
      width: BRANDING_TARGET_WIDTH,
      height: BRANDING_TARGET_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);

  if (!rendered || rendered.info.width <= 0 || rendered.info.height <= 0) {
    return undefined;
  }

  return {
    width: rendered.info.width,
    height: rendered.info.height,
    rgbData: new Uint8Array(rendered.data),
  };
};
