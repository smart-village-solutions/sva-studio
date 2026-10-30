import { fetchPublicHttps } from '@sva/server-runtime';

import sharp from 'sharp';
import type { WasteCalendarPdfBrandingImage } from '@sva/waste-management-contracts';

const BRANDING_TARGET_WIDTH = 326;
const BRANDING_TARGET_HEIGHT = 124;
const BRANDING_FETCH_TIMEOUT_MS = 5_000;
const MAX_BRANDING_ASSET_BYTES = 2 * 1024 * 1024;

const isExplicitDevOriginHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  );
};

const parseBrandingUrls = (input: { readonly assetUrl: string; readonly requestUrl?: string }) => {
  const requestUrl = input.requestUrl ? new URL(input.requestUrl) : null;
  const assetUrl = requestUrl ? new URL(input.assetUrl, requestUrl) : new URL(input.assetUrl);

  return {
    assetUrl,
    requestUrl,
    sameOriginDevRequest: Boolean(
      requestUrl &&
      process.env.NODE_ENV !== 'production' &&
      assetUrl.origin === requestUrl.origin &&
      isExplicitDevOriginHost(requestUrl.hostname)
    ),
  };
};

const allowsBrandingProtocol = (assetUrl: URL, sameOriginDevRequest: boolean): boolean =>
  sameOriginDevRequest || assetUrl.protocol === 'https:';

const readBrandingAssetBuffer = async (response: Response): Promise<Buffer | null> => {
  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BRANDING_ASSET_BYTES) {
    return null;
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length <= MAX_BRANDING_ASSET_BYTES ? buffer : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk)),
        totalLength
      );
    }

    totalLength += value.length;
    if (totalLength > MAX_BRANDING_ASSET_BYTES) {
      return null;
    }
    chunks.push(value);
  }
};

export const loadPublicWastePdfBrandingImage = async (input: {
  readonly assetUrl: string;
  readonly requestUrl?: string;
}): Promise<WasteCalendarPdfBrandingImage | undefined> => {
  const parsed = (() => {
    try { return parseBrandingUrls(input); } catch { return null; }
  })();
  if (!parsed || !allowsBrandingProtocol(parsed.assetUrl, parsed.sameOriginDevRequest)) {
    return undefined;
  }

  // Only the existing explicit localhost development case may bypass public HTTPS validation.
  const fetchAsset = parsed.sameOriginDevRequest ? fetch : fetchPublicHttps;
  const response = await fetchAsset(parsed.assetUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(BRANDING_FETCH_TIMEOUT_MS),
  }).catch(() => null);
  if (!response?.ok) {
    return undefined;
  }

  const assetBuffer = await readBrandingAssetBuffer(response);
  if (!assetBuffer) {
    return undefined;
  }

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
