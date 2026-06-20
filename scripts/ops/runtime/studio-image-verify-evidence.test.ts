import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStudioImageVerifyEvidenceReaders, sanitizeVerifyArtifactSuffix } from './studio-image-verify-evidence.ts';

describe('studio image verify evidence', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  const createTempRuntimeArtifactsDir = () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'studio-image-verify-evidence-'));
    tempDirs.push(tempDir);
    return tempDir;
  };

  it('sanitizes verify artifact suffixes compatibly', () => {
    expect(sanitizeVerifyArtifactSuffix(' release / tag: 1.2.3 ')).toBe('release-tag-1.2.3');
  });

  it('reads the newest matching local verify artifact and ignores unreadable history', () => {
    const runtimeArtifactsDir = createTempRuntimeArtifactsDir();
    const imageVerifyDir = resolve(runtimeArtifactsDir, 'image-verify');
    mkdirSync(imageVerifyDir, { recursive: true });

    writeFileSync(resolve(imageVerifyDir, '2024-01.json'), '{invalid-json');
    writeFileSync(
      resolve(imageVerifyDir, '2024-02.json'),
      JSON.stringify({
        imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
        reportId: 'older-report',
        status: 'ok',
      }),
    );
    writeFileSync(
      resolve(imageVerifyDir, '2024-03.json'),
      JSON.stringify({
        imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
        reportId: 'newer-report',
        status: 'ok',
      }),
    );

    const readers = createStudioImageVerifyEvidenceReaders({
      commandExists: () => false,
      runCapture: () => {
        throw new Error('runCapture should not be called');
      },
      runtimeArtifactsDir,
    });

    expect(readers.readLocalStudioImageVerifyEvidence('sha256:deadbeef')).toEqual({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
      path: resolve(imageVerifyDir, '2024-03.json'),
      reportId: 'newer-report',
      source: 'local-artifact',
      status: 'ok',
    });
  });

  it('reads github verify evidence via sanitized image-tag artifact names', () => {
    const runCapture = vi.fn<(command: string, args?: readonly string[]) => string>();
    runCapture.mockImplementation((command, args) => {
      if (command === 'git') {
        expect(args).toEqual(['config', '--get', 'remote.origin.url']);
        return 'git@github.com:smart-village-solutions/sva-studio.git\n';
      }

      if (command === 'gh' && args?.[0] === 'api') {
        expect(args[1]).toBe('repos/smart-village-solutions/sva-studio/actions/artifacts?per_page=100&page=1');
        return JSON.stringify({
          artifacts: [
            {
              expired: false,
              id: 101,
              name: 'studio-image-verify-release-tag-1.2.3-20240619',
              workflow_run: { id: 9876 },
            },
          ],
        });
      }

      if (command === 'gh' && args?.[0] === 'run') {
        expect(args).toEqual(['run', 'view', '9876', '--json', 'conclusion,url,workflowName']);
        return JSON.stringify({
          conclusion: 'success',
          url: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/9876',
          workflowName: 'Studio Image Verify',
        });
      }

      throw new Error(`Unexpected command: ${command} ${args?.join(' ') ?? ''}`);
    });

    const readArtifactEvidenceImpl = vi.fn(() => ({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeefcafebabe',
      reportId: 'report-123',
      status: 'ok' as const,
    }));

    const readers = createStudioImageVerifyEvidenceReaders({
      commandExists: (commandName) => commandName === 'gh',
      runCapture,
      runtimeArtifactsDir: '/unused',
    });

    expect(
      readers.tryReadGithubStudioImageVerifyEvidence('sha256:deadbeefcafebabe', {
        imageTag: ' release / tag: 1.2.3 ',
        readArtifactEvidenceImpl,
      }),
    ).toEqual({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeefcafebabe',
      path: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/9876',
      reportId: 'report-123',
      source: 'github-artifact',
      status: 'ok',
    });

    expect(readArtifactEvidenceImpl).toHaveBeenCalledWith({
      artifactId: 101,
      artifactName: 'studio-image-verify-release-tag-1.2.3-20240619',
      imageDigest: 'sha256:deadbeefcafebabe',
      owner: 'smart-village-solutions',
      repo: 'sva-studio',
      runId: 9876,
    });
  });

  it('falls back to github evidence when no local artifact exists', () => {
    const readers = createStudioImageVerifyEvidenceReaders({
      commandExists: (commandName) => commandName === 'gh',
      runCapture: (command, args) => {
        if (command === 'git') {
          return 'https://github.com/smart-village-solutions/sva-studio.git\n';
        }

        if (command === 'gh' && args?.[0] === 'api') {
          return JSON.stringify({
            artifacts: [
              {
                expired: false,
                id: 44,
                name: 'studio-image-verify-deadbeefcafe-20240619',
                workflow_run: { id: 321 },
              },
            ],
          });
        }

        if (command === 'gh' && args?.[0] === 'run') {
          return JSON.stringify({
            conclusion: 'success',
            workflowName: 'Studio Image Verify',
          });
        }

        throw new Error(`Unexpected command: ${command} ${args?.join(' ') ?? ''}`);
      },
      runtimeArtifactsDir: createTempRuntimeArtifactsDir(),
    });

    expect(
      readers.readStudioImageVerifyEvidence('sha256:deadbeefcafefeed', {
        imageTag: 'ignored-when-digest-prefix-matches',
      }),
    ).toEqual({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeefcafefeed',
      path: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/321',
      reportId: 'studio-image-verify-deadbeefcafe-20240619',
      source: 'github-artifact',
      status: 'ok',
    });
  });

  it('prefers local evidence over github evidence', () => {
    const runtimeArtifactsDir = createTempRuntimeArtifactsDir();
    const imageVerifyDir = resolve(runtimeArtifactsDir, 'image-verify');
    mkdirSync(imageVerifyDir, { recursive: true });
    writeFileSync(
      resolve(imageVerifyDir, '2024-03.json'),
      JSON.stringify({
        imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
        reportId: 'local-report',
        status: 'ok',
      }),
    );

    const readers = createStudioImageVerifyEvidenceReaders({
      commandExists: () => true,
      runCapture: () => {
        throw new Error('github fallback should not be called when local evidence exists');
      },
      runtimeArtifactsDir,
    });

    expect(readers.readStudioImageVerifyEvidence('sha256:deadbeef')).toEqual({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
      path: resolve(imageVerifyDir, '2024-03.json'),
      reportId: 'local-report',
      source: 'local-artifact',
      status: 'ok',
    });
  });

  it('returns undefined when github lookup errors', () => {
    const readers = createStudioImageVerifyEvidenceReaders({
      commandExists: (commandName) => commandName === 'gh',
      runCapture: () => {
        throw new Error('gh failed');
      },
      runtimeArtifactsDir: createTempRuntimeArtifactsDir(),
    });

    expect(readers.tryReadGithubStudioImageVerifyEvidence('sha256:deadbeef')).toBeUndefined();
  });
});
