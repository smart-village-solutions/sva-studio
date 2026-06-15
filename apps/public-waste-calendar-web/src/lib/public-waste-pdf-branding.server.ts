import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import sharp from 'sharp';
import type { WasteCalendarPdfBrandingImage } from '@sva/core/waste-output';

const BRANDING_TARGET_WIDTH = 326;
const BRANDING_TARGET_HEIGHT = 124;
const BRANDING_FETCH_TIMEOUT_MS = 5_000;
const MAX_BRANDING_ASSET_BYTES = 2 * 1024 * 1024;

const isPrivateIpv4Address = (address: string): boolean => {
  const octets = address.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const isPrivateIpv6Address = (address: string): boolean => {
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
};

const isPrivateIpAddress = (address: string): boolean => {
  const normalized = address.trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4Address(normalized.slice('::ffff:'.length));
  }

  return isIP(normalized) === 4 ? isPrivateIpv4Address(normalized) : isPrivateIpv6Address(normalized);
};

const isExplicitDevOriginHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '127.0.0.1' || normalized === '::1';
};

const resolveSafeBrandingAssetUrl = async (input: {
  readonly assetUrl: string;
  readonly requestUrl?: string;
}): Promise<URL | null> => {
  const requestUrl = input.requestUrl ? new URL(input.requestUrl) : null;
  const url = requestUrl ? new URL(input.assetUrl, requestUrl) : new URL(input.assetUrl);
  const isSameOrigin = requestUrl ? url.origin === requestUrl.origin && isExplicitDevOriginHost(requestUrl.hostname) : false;

  if (!isSameOrigin && url.protocol !== 'https:') {
    return null;
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!isSameOrigin && (hostname === 'localhost' || hostname.endsWith('.localhost'))) {
    return null;
  }

  if (isIP(hostname) !== 0) {
    return !isSameOrigin && isPrivateIpAddress(hostname) ? null : url;
  }

  if (isSameOrigin) {
    return url;
  }

  const resolvedAddresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (resolvedAddresses.length === 0 || resolvedAddresses.some((entry) => isPrivateIpAddress(entry.address))) {
    return null;
  }

  return url;
};

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
      return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalLength);
    }

    totalLength += value.length;
    if (totalLength > MAX_BRANDING_ASSET_BYTES) {
      return null;
    }
    chunks.push(value);
  }
};

export const loadPublicWastePdfBrandingImage = async (
  input: {
    readonly assetUrl: string;
    readonly requestUrl?: string;
  }
): Promise<WasteCalendarPdfBrandingImage | undefined> => {
  const safeAssetUrl = await resolveSafeBrandingAssetUrl(input).catch(() => null);
  if (!safeAssetUrl) {
    return undefined;
  }

  const response = await fetch(safeAssetUrl, {
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
