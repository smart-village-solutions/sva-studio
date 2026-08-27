import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseBuildWikiPublicationOptions, writeWikiPublication } from './build-wiki-publication';
import type { DocumentationIntegrityInput } from './documentation-integrity';
import { buildWikiPublication, type WikiPublication, wikiSlugForPath } from './wiki-publication';

const navigationPaths = [
  'docs/README.md',
  'docs/adr/README.md',
  'docs/architecture/README.md',
  'docs/development/README.md',
  'docs/development/dokumentations-integritaetsgate.md',
  'docs/development/review-agent-governance.md',
  'docs/development/testing-strategy.md',
  'docs/governance/README.md',
  'docs/governance/security-policy.md',
  'docs/guides/studio-rollout-process.md',
  'docs/operations/README.md',
  'docs/operations/incident-response.md',
  'docs/reference/README.md',
] as const;

const createInput = (
  files: ReadonlyMap<string, string>,
  additionalTrackedPaths: readonly string[] = [],
  validateWikiNavigation = false
): DocumentationIntegrityInput => ({
  files,
  manifestEntries: [':(glob)docs/**'],
  publishedPaths: new Set(files.keys()),
  trackedPaths: new Set([...files.keys(), ...additionalTrackedPaths]),
  validateWikiNavigation,
  wikiWorkflow:
    'uses: ./.github/actions/setup-pnpm-workspace\nrun: pnpm check:docs\nrun: pnpm exec tsx scripts/ci/build-wiki-publication.ts --output wiki\n',
});

describe('Wiki publication', () => {
  it('creates deterministic root slugs for articles and area indexes', () => {
    expect(wikiSlugForPath('docs/README.md')).toBe('dokumentation');
    expect(wikiSlugForPath('docs/development/README.md')).toBe('development');
    expect(wikiSlugForPath('docs/development/testing-strategy.md')).toBe(
      'development--testing-strategy'
    );
    expect(wikiSlugForPath('docs/Änderungen/Größe.md')).toBe('anderungen--grosse');
  });

  it('rewrites Markdown pages, anchors, artifacts, images and repository links', () => {
    const files = new Map([
      [
        'docs/README.md',
        '# Dokumentation\n\n[Entwicklung](./development/README.md#setup)\n\n[API](./api/schema.yaml)\n\n![Logo][logo]\n\n[Script][script]\n\n[logo]: ./images/logo.png\n[script]: ../scripts/example.ts\n',
      ],
      ['docs/development/README.md', '# Entwicklung\n'],
      ['docs/api/schema.yaml', 'openapi: 3.1.0\n'],
      ['docs/images/logo.png', 'binary'],
    ]);

    const result = buildWikiPublication(createInput(files, ['scripts/example.ts']));

    expect(result.issues).toEqual([]);
    const overview = result.publication?.files.get('dokumentation.md');
    expect(overview).toContain('[Entwicklung](development#setup)');
    expect(overview).toContain(
      '[API (Quellartefakt)](https://github.com/smart-village-solutions/sva-studio/blob/main/docs/api/schema.yaml "Quellartefakt im Repository")'
    );
    expect(overview).toContain(
      '![Logo](https://github.com/smart-village-solutions/sva-studio/raw/main/docs/images/logo.png)'
    );
    expect(overview).toContain(
      '[Script (Quellartefakt)](https://github.com/smart-village-solutions/sva-studio/blob/main/scripts/example.ts "Quellartefakt im Repository")'
    );
    expect(overview).not.toContain('[script]:');
    expect(overview).not.toContain('[logo]:');
    expect(overview).toContain(
      'Automatisch aus [`docs/README.md`](https://github.com/smart-village-solutions/sva-studio/blob/main/docs/README.md) veröffentlicht.'
    );
  });

  it('reports slug collisions before producing a publication', () => {
    const files = new Map([
      ['docs/foo.md', '# Foo\n'],
      ['docs/foo/README.md', '# Foo Index\n'],
    ]);

    const result = buildWikiPublication(createInput(files));

    expect(result.publication).toBeUndefined();
    expect(result.issues).toContainEqual({
      code: 'wiki-publication',
      line: 1,
      path: 'docs/foo/README.md',
      reason: 'Wiki-Slug-Kollision „foo“ mit docs/foo.md',
    });
  });

  it('rejects source pages that collide with generated Wiki navigation pages', () => {
    const result = buildWikiPublication(createInput(new Map([['docs/Home.md', '# Home\n']])));

    expect(result.publication).toBeUndefined();
    expect(result.issues).toContainEqual({
      code: 'wiki-publication',
      line: 1,
      path: 'docs/Home.md',
      reason: 'Wiki-Slug „home“ ist für die generierte Navigation reserviert',
    });
  });

  it('reports relative targets that cannot be transformed', () => {
    const files = new Map([['docs/README.md', '# Dokumentation\n\n[Fehlt](./missing.md)\n']]);

    const result = buildWikiPublication(createInput(files));

    expect(result.publication).toBeUndefined();
    expect(result.issues).toContainEqual({
      code: 'wiki-publication',
      line: 3,
      path: 'docs/README.md',
      reason: 'Wiki-Link kann nicht transformiert werden: ./missing.md',
    });
  });

  it('generates a task-first Home and a compact Sidebar with rendered targets', () => {
    const files = new Map(navigationPaths.map((sourcePath) => [sourcePath, `# ${sourcePath}\n`]));

    const result = buildWikiPublication(createInput(files, [], true));

    expect(result.issues).toEqual([]);
    const home = result.publication?.files.get('Home.md');
    const sidebar = result.publication?.files.get('_Sidebar.md');
    expect(home).toContain('## Was möchtest du tun?');
    expect(home).toContain('[Studio lokal einrichten](development)');
    expect(home).toContain('## Kritische Einstiege');
    expect(home).toContain('## Themenbereiche');
    expect(home).not.toContain('docs/README.md)');
    expect(sidebar?.trim().split('\n')).toHaveLength(10);
    expect(sidebar).toContain('[Aufgaben](Home#was-möchtest-du-tun)');
    expect(sidebar).not.toContain('docs/');
  });

  it('replaces a cloned Wiki working tree without keeping nested raw pages', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'wiki-publication-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
      execFileSync(
        'git',
        [
          'remote',
          'add',
          'origin',
          'https://x-access-token:test-token@github.com/smart-village-solutions/sva-studio.wiki.git',
        ],
        { cwd: rootDir }
      );
      mkdirSync(path.join(rootDir, 'docs'));
      writeFileSync(path.join(rootDir, 'docs/README.md'), '# Raw\n');
      writeFileSync(path.join(rootDir, 'Home.md'), '# Alt\n');
      const publication: WikiPublication = {
        files: new Map([
          ['Home.md', '# Neu\n'],
          ['development.md', '# Entwicklung\n'],
        ]),
        slugs: new Map([['docs/development/README.md', 'development']]),
      };

      writeWikiPublication(publication, rootDir);

      expect(existsSync(path.join(rootDir, '.git'))).toBe(true);
      expect(existsSync(path.join(rootDir, 'docs'))).toBe(false);
      expect(readFileSync(path.join(rootDir, 'Home.md'), 'utf8')).toBe('# Neu\n');
      expect(readFileSync(path.join(rootDir, 'development.md'), 'utf8')).toBe('# Entwicklung\n');
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });

  it('refuses to delete files in a Git checkout other than the SVA Studio Wiki', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'wiki-publication-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
      execFileSync(
        'git',
        ['remote', 'add', 'origin', 'https://github.com/smart-village-solutions/sva-studio.git'],
        { cwd: rootDir }
      );
      writeFileSync(path.join(rootDir, 'important.txt'), 'keep');
      const publication: WikiPublication = { files: new Map(), slugs: new Map() };

      expect(() => writeWikiPublication(publication, rootDir)).toThrow(
        'verweist nicht auf das erwartete SVA-Studio-Wiki'
      );
      expect(readFileSync(path.join(rootDir, 'important.txt'), 'utf8')).toBe('keep');
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });

  it('accepts the expected Wiki remote without an optional .git suffix', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'wiki-publication-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
      execFileSync(
        'git',
        ['remote', 'add', 'origin', 'https://github.com/smart-village-solutions/sva-studio.wiki'],
        { cwd: rootDir }
      );
      writeFileSync(path.join(rootDir, 'old-page.md'), '# Alt\n');

      writeWikiPublication({ files: new Map(), slugs: new Map() }, rootDir);

      expect(existsSync(path.join(rootDir, 'old-page.md'))).toBe(false);
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });

  it('refuses to overwrite a non-Wiki directory', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'wiki-publication-'));
    try {
      writeFileSync(path.join(rootDir, 'important.txt'), 'keep');
      const publication: WikiPublication = { files: new Map(), slugs: new Map() };

      expect(() => writeWikiPublication(publication, rootDir)).toThrow(
        'Bestehendes Wiki-Ausgabeverzeichnis ist kein Git-Checkout'
      );
      expect(readFileSync(path.join(rootDir, 'important.txt'), 'utf8')).toBe('keep');
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });

  it('parses the required output option without accepting unknown arguments', () => {
    expect(parseBuildWikiPublicationOptions(['--output', 'wiki'])).toEqual({
      outputPath: 'wiki',
    });
    expect(parseBuildWikiPublicationOptions(['--output=wiki'])).toEqual({
      outputPath: 'wiki',
    });
    expect(() => parseBuildWikiPublicationOptions([])).toThrow('Fehlendes Pflichtargument');
    expect(() => parseBuildWikiPublicationOptions(['--unknown'])).toThrow('Unbekanntes Argument');
  });
});
