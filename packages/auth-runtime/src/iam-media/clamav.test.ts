import { createServer, type AddressInfo, type Server } from 'node:net';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkClamAvFreshness, scanWithClamAv, scanConfiguredMedia } from './clamav.js';

const servers: Server[] = [];
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
  );
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});

describe('ClamAV upload scan', () => {
  it('rejects a scanner that accepts the connection but never completes its reply', async () => {
    const server = createServer((socket) => {
      socket.on('data', () => undefined);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    await expect(
      scanWithClamAv(Buffer.from('test'), {
        host: '127.0.0.1',
        port: (server.address() as AddressInfo).port,
        timeoutMs: 50,
        signatureStatePath: 'unused',
      })
    ).rejects.toThrow('media_scan_unavailable');
  });

  it.each([
    { MEDIA_CLAMAV_HOST: '' },
    { MEDIA_CLAMAV_SIGNATURE_STATE_PATH: '' },
    { MEDIA_CLAMAV_PORT: '0' },
    { MEDIA_CLAMAV_PORT: '65536' },
    { MEDIA_CLAMAV_PORT: '1.5' },
    { MEDIA_CLAMAV_TIMEOUT_MS: '99' },
    { MEDIA_CLAMAV_TIMEOUT_MS: '120001' },
    { MEDIA_CLAMAV_TIMEOUT_MS: 'NaN' },
  ])('rejects invalid runtime scanner configuration before connecting: %j', async (invalid) => {
    vi.stubEnv('MEDIA_CLAMAV_HOST', '127.0.0.1');
    vi.stubEnv('MEDIA_CLAMAV_SIGNATURE_STATE_PATH', 'unused');
    vi.stubEnv('MEDIA_CLAMAV_PORT', '3310');
    vi.stubEnv('MEDIA_CLAMAV_TIMEOUT_MS', '30000');
    for (const [name, value] of Object.entries(invalid)) vi.stubEnv(name, value);
    await expect(scanConfiguredMedia(Buffer.from('test'))).rejects.toThrow(
      'media_scan_unavailable'
    );
  });
  it.each(['missing-proof', 'changed-version', 'oversized-reply', 'closed-stream'] as const)(
    'refuses a clean verdict when %s prevents a complete verified exchange',
    async (mode) => {
      const directory = await mkdtemp(join(process.cwd(), '.studio-clamav-'));
      directories.push(directory);
      const signatureStatePath = join(directory, 'state');
      if (mode !== 'missing-proof')
        await writeFile(signatureStatePath, `${Math.floor(Date.now() / 1000)} 42\n`);
      let versions = 0;
      const server = createServer((socket) => {
        let request = Buffer.alloc(0);
        socket.on('data', (chunk) => {
          request = Buffer.concat([request, chunk]);
          if (request.toString().startsWith('zVERSION\0')) {
            versions++;
            socket.end(
              `ClamAV ${mode === 'changed-version' && versions > 1 ? '1.5' : '1.4'}/42/date\0`
            );
          } else if (request.length >= 10 && request.subarray(-4).equals(Buffer.alloc(4))) {
            if (mode === 'closed-stream') socket.end();
            else socket.end(mode === 'oversized-reply' ? `${'x'.repeat(4097)}\0` : 'stream: OK\0');
          }
        });
      });
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      await expect(
        scanWithClamAv(Buffer.from('test'), {
          host: '127.0.0.1',
          port: (server.address() as AddressInfo).port,
          timeoutMs: 1000,
          signatureStatePath,
        })
      ).rejects.toThrow(
        mode === 'changed-version'
          ? 'media_scan_stale'
          : mode === 'missing-proof'
            ? 'media_scan_unavailable'
            : 'media_scan_incomplete'
      );
    }
  );

  it('requires a matching, non-expired freshness proof, including across restarts', () => {
    const now = 1800000000000;
    const proof = (age: number) => `${(now - age) / 1000} 42\n`;
    expect(checkClamAvFreshness(proof(24 * 3600000), 'ClamAV 1.4/42/date', now)).toBe(24 * 3600000);
    for (const state of ['', proof(72 * 3600000), `${now / 1000} 41`, `${now / 1000 + 60} 42`]) {
      expect(() => checkClamAvFreshness(state, 'ClamAV 1.4/42/date', now)).toThrow(
        'media_scan_stale'
      );
    }
  });
  it.each([
    'stream: OK',
    'stream: Eicar-Test-Signature FOUND',
    'stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND',
    'INSTREAM size limit exceeded. ERROR',
    'unexpected',
  ])('handles %s without leaking scanner details', async (reply) => {
    const directory = await mkdtemp(join(process.cwd(), '.studio-clamav-'));
    directories.push(directory);
    const signatureStatePath = join(directory, 'state');
    await writeFile(signatureStatePath, `${Math.floor(Date.now() / 1000)} 42\n`);
    const received: Buffer[] = [];
    const server = createServer((socket) => {
      let request = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        request = Buffer.concat([request, chunk]);
        if (request.toString().startsWith('zVERSION\0')) {
          socket.end('ClamAV 1.4/42/date\0');
          return;
        }
        if (request.length >= 10 && request.subarray(-4).equals(Buffer.alloc(4))) {
          received.push(request);
          socket.end(`${reply}\0`);
        }
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const scan = scanWithClamAv(Buffer.from('hello'), {
      host: '127.0.0.1',
      port: (server.address() as AddressInfo).port,
      timeoutMs: 1000,
      signatureStatePath,
    });
    if (reply === 'stream: OK') await expect(scan).resolves.toBeUndefined();
    else
      await expect(scan).rejects.toThrow(
        reply.includes(' FOUND') && !reply.includes('Heuristics.Limits.Exceeded')
          ? 'media_scan_infected'
          : 'media_scan_incomplete'
      );
    expect(received[0]?.subarray(10, 14).readUInt32BE()).toBe(5);
    expect(received[0]?.subarray(14, 19).toString()).toBe('hello');
  });
});
