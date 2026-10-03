import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EvidenceCaseRecord, EvidenceConfig } from './iam-evidence.ts';
import type { Browser } from './iam-evidence-session.ts';
import { runWp006Evidence } from './iam-evidence-wp006.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('IAM evidence runner', () => {
  it('records consent and export cases, archives both responses, and closes each session', async () => {
    const reportDirectory = await mkdtemp(join(tmpdir(), 'iam-evidence-runner-'));
    temporaryDirectories.push(reportDirectory);
    const artifactDirectory = join(reportDirectory, 'artifacts');
    const records: EvidenceCaseRecord[] = [];
    const closePage = vi.fn().mockResolvedValue(undefined);
    const closeContext = vi.fn().mockResolvedValue(undefined);
    const response = (status: number, body: string) => ({
      headers: () => ({ 'content-type': 'application/json' }),
      status: () => status,
      text: async () => body,
    });
    const locator = {
      click: vi.fn().mockResolvedValue(undefined),
      count: async () => 1,
      fill: vi.fn().mockResolvedValue(undefined),
      first() {
        return this;
      },
      isVisible: async () => true,
    };
    const browser = {
      newContext: vi.fn().mockImplementation(async () => {
        const actor = browser.newContext.mock.calls.length;
        const page = {
          close: closePage,
          getByRole: () => locator,
          getByText: () => locator,
          goto: vi.fn().mockResolvedValue(undefined),
          locator: () => locator,
          screenshot: async ({ path }: { path: string }) => writeFile(path, 'image'),
          waitForLoadState: vi.fn().mockResolvedValue(undefined),
          waitForURL: vi.fn().mockResolvedValue(undefined),
        };
        return {
          close: closeContext,
          newPage: async () => page,
          request: {
            get: async (url: string) =>
              url.endsWith('/auth/me')
                ? response(200, JSON.stringify({ user: { id: 'u1', instanceId: 'i1', roles: [] } }))
                : response(
                    actor === 3 ? 403 : 200,
                    actor === 3 ? '{"error":"forbidden"}' : '{"consents":[]}'
                  ),
          },
        };
      }),
    };
    const config = {
      acceptance: { baseUrl: 'https://studio.example.test', instanceId: 'i1' },
      instanceActor: { username: 'member', password: 'secret' },
      rootActor: { username: 'admin', password: 'secret' },
      negativeActor: { username: 'negative', password: 'secret' },
    } as EvidenceConfig;

    await runWp006Evidence({
      browser: browser as unknown as Browser,
      config,
      recordCase: (entry) => {
        records.push(entry);
        return entry;
      },
      reportDirectory,
      runPaths: { artifactDirectory, reportFileBase: 'test-run' },
    });

    expect(records.map(({ status }) => status)).toEqual(['passed', 'passed', 'passed']);
    expect(browser.newContext).toHaveBeenCalledTimes(3);
    expect(closePage).toHaveBeenCalledTimes(3);
    expect(closeContext).toHaveBeenCalledTimes(3);
    expect(
      await readFile(join(artifactDirectory, 'wp-006-consent-export-positive.json'), 'utf8')
    ).toBe('{"consents":[]}');
    expect(
      await readFile(join(artifactDirectory, 'wp-006-consent-export-negative.json'), 'utf8')
    ).toBe('{"error":"forbidden"}');
  });
});
