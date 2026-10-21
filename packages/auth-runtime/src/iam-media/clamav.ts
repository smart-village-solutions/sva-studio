import { createConnection } from 'node:net';
import { readFile } from 'node:fs/promises';
import { metrics } from '@opentelemetry/api';
import { createSdkLogger } from '@sva/server-runtime';
import { getMediaScanEnabled } from '../runtime-secrets.js';

const logger = createSdkLogger({ component: 'media-scan', level: 'info' });
const meter = metrics.getMeter('sva.media.scan');
meter
  .createObservableGauge('media_scan_enabled')
  .addCallback((result) => result.observe(isMediaScanEnabled() ? 1 : 0));
meter
  .createObservableGauge('media_scan_signature_check_age_seconds', { unit: 's' })
  .addCallback(async (result) => {
    if (!isMediaScanEnabled()) return;
    try {
      const config = resolveClamAvConfig();
      // Bound collection independently of the longer file-scan timeout.
      const version = await exchange(
        { ...config, timeoutMs: Math.min(config.timeoutMs, 1000) },
        'VERSION'
      );
      const state = await readFile(config.signatureStatePath, 'utf8');
      result.observe(checkClamAvFreshness(state, version) / 1000);
    } catch {
      result.observe(72 * 3600);
    }
  });
const scanCounter = meter.createCounter('media_scan_results_total');
const warningAgeMs = 24 * 60 * 60 * 1000;
const blockedAgeMs = 72 * 60 * 60 * 1000;

export const isMediaScanEnabled = getMediaScanEnabled;
export class MediaScanError extends Error {
  constructor(
    readonly code:
      | 'media_scan_infected'
      | 'media_scan_unavailable'
      | 'media_scan_stale'
      | 'media_scan_incomplete'
  ) {
    super(code);
    this.name = 'MediaScanError';
  }
}

type ClamAvConfig = Readonly<{
  host: string;
  port: number;
  timeoutMs: number;
  signatureStatePath: string;
}>;

// clamd replies are bounded, NUL-terminated records. The timeout covers the entire exchange.
const exchange = (config: ClamAvConfig, command: string, body?: Uint8Array): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port });
    let response = Buffer.alloc(0);
    let finished = false;
    const finish = (error?: Error, value?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(value ?? '');
    };
    const timer = setTimeout(
      () => finish(new MediaScanError('media_scan_unavailable')),
      config.timeoutMs
    );
    socket.on('error', () => finish(new MediaScanError('media_scan_unavailable')));
    socket.on('close', () => finish(new MediaScanError('media_scan_incomplete')));
    socket.on('data', (data: Buffer) => {
      if (response.length + data.length > 4096)
        return finish(new MediaScanError('media_scan_incomplete'));
      response = Buffer.concat([response, data]);
      const end = response.indexOf(0);
      if (end >= 0) finish(undefined, response.subarray(0, end).toString('utf8'));
    });
    socket.on('connect', () => {
      socket.write(`z${command}\0`);
      if (body) {
        for (let offset = 0; offset < body.length; offset += 65536) {
          const chunk = body.subarray(offset, offset + 65536);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });

export const checkClamAvFreshness = (
  state: string,
  loadedVersion: string,
  now = Date.now()
): number => {
  const proof = /^(\d+) (\d+)\n?$/.exec(state);
  const loaded = /^ClamAV [^/]+\/(\d+)\//.exec(loadedVersion);
  if (!proof || !loaded || proof[2] !== loaded[1]) throw new MediaScanError('media_scan_stale');
  const age = now - Number(proof[1]) * 1000;
  if (!Number.isFinite(age) || age < -5000 || age >= blockedAgeMs)
    throw new MediaScanError('media_scan_stale');
  return Math.max(0, age);
};

export const scanWithClamAv = async (body: Uint8Array, config: ClamAvConfig): Promise<void> => {
  const verify = async () => {
    const version = await exchange(config, 'VERSION');
    const state = await readFile(config.signatureStatePath, 'utf8');
    const age = checkClamAvFreshness(state, version);
    if (age >= warningAgeMs)
      logger.warn('Media scanner signatures require an update check', {
        reason_code: 'media_scan_signatures_aging',
        age_seconds: Math.floor(age / 1000),
      });
    return version;
  };
  try {
    const version = await verify();
    const result = await exchange(config, 'INSTREAM', body);
    if (result !== 'stream: OK') {
      throw new MediaScanError(
        result.startsWith('stream: ') && result.endsWith(' FOUND') && !result.startsWith('stream: Heuristics.Limits.Exceeded')
          ? 'media_scan_infected'
          : 'media_scan_incomplete'
      );
    }
    if ((await verify()) !== version) throw new MediaScanError('media_scan_stale');
    scanCounter.add(1, { result: 'clean' });
  } catch (error) {
    const failure =
      error instanceof MediaScanError ? error : new MediaScanError('media_scan_unavailable');
    scanCounter.add(1, { result: failure.code });
    logger.warn('Media scan did not authorize release', { reason_code: failure.code });
    throw failure;
  }
};

const resolveClamAvConfig = (): ClamAvConfig => {
  const host = process.env.MEDIA_CLAMAV_HOST;
  const port = Number(process.env.MEDIA_CLAMAV_PORT ?? 3310);
  const timeoutMs = Number(process.env.MEDIA_CLAMAV_TIMEOUT_MS ?? 30000);
  const signatureStatePath = process.env.MEDIA_CLAMAV_SIGNATURE_STATE_PATH;
  if (
    !host ||
    !signatureStatePath ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 120000
  )
    throw new MediaScanError('media_scan_unavailable');
  return { host, port, timeoutMs, signatureStatePath };
};

export const scanConfiguredMedia = async (body: Uint8Array): Promise<void> =>
  scanWithClamAv(body, resolveClamAvConfig());
