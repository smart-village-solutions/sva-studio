import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const workflow = readFileSync(resolve(workspaceRoot, '.github/workflows/wiki-sync.yml'), 'utf8');
const publicationManifestPath = 'config/documentation/wiki-publication-paths.txt';
const publicationManifest = readFileSync(resolve(workspaceRoot, publicationManifestPath), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const selectedFiles = execFileSync('git', ['ls-files', '--', ...publicationManifest], {
  cwd: workspaceRoot,
  encoding: 'utf8',
})
  .split('\n')
  .filter((line) => line.length > 0);
const selectedFileSet = new Set(selectedFiles);
const trackedDocumentationFiles = new Set(
  execFileSync('git', ['ls-files', 'docs'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((line) => line.length > 0)
);

const excludedPublicationPrefixes = [
  'docs/architecture/decisions/',
  'docs/changelog/',
  'docs/pr/',
  'docs/reports/',
  'docs/staging/',
  'docs/superpowers/',
  'docs/user-documentation/',
] as const;

describe('wiki sync workflow contract', () => {
  it('builds the rendered publication from the versioned manifest', () => {
    expect(workflow).toContain(`- '${publicationManifestPath}'`);
    expect(workflow).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('"$GITHUB_REF" != "refs/heads/main"');
    expect(workflow).toContain('uses: ./.github/actions/setup-pnpm-workspace');
    expect(workflow).toContain('run: pnpm check:docs');
    expect(workflow).toContain(
      'run: pnpm exec tsx scripts/ci/build-wiki-publication.ts --output wiki'
    );
    expect(workflow).not.toContain('wiki/docs');
    expect(workflow).not.toContain('rsync');
  });

  it('selects every declared pathspec and only current local documentation', () => {
    for (const pathspec of publicationManifest) {
      const matches = execFileSync('git', ['ls-files', '--', pathspec], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim();

      expect(matches, `unmatched publication pathspec: ${pathspec}`).not.toBe('');
    }

    expect(selectedFiles).toContain('docs/README.md');
    expect(selectedFiles).toContain('docs/architecture/README.md');
    expect(selectedFiles).toContain('docs/adr/README.md');
    expect(selectedFiles).toContain('docs/guides/studio-rollout-process.md');

    for (const excludedPrefix of excludedPublicationPrefixes) {
      expect(selectedFiles.some((file) => file.startsWith(excludedPrefix))).toBe(false);
    }
  });

  it('does not inline raw entry pages in the workflow', () => {
    expect(workflow).not.toContain('cat > wiki/Home.md');
    expect(workflow).not.toContain('cat > wiki/_Sidebar.md');
    expect(workflow).not.toContain('](docs/');
  });

  it('does not leave relative links to tracked documentation outside the publication', () => {
    const unpublishedLinkTargets: string[] = [];

    for (const sourcePath of selectedFiles.filter((file) => file.endsWith('.md'))) {
      const source = readFileSync(resolve(workspaceRoot, sourcePath), 'utf8');

      for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/gu)) {
        const rawTarget = match[1]?.replace(/^<|>$/gu, '');
        if (!rawTarget || /^(?:[a-z][a-z\d+.-]*:|#|\/)/iu.test(rawTarget)) {
          continue;
        }

        const targetPath = rawTarget.split(/[?#]/u, 1)[0];
        if (!targetPath) {
          continue;
        }

        const resolvedTarget = posix.normalize(posix.join(posix.dirname(sourcePath), targetPath));
        if (trackedDocumentationFiles.has(resolvedTarget) && !selectedFileSet.has(resolvedTarget)) {
          unpublishedLinkTargets.push(`${sourcePath} -> ${resolvedTarget}`);
        }
      }
    }

    expect(unpublishedLinkTargets).toEqual([]);
  });
});
