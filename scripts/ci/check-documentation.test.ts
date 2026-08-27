import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatDocumentationIssue } from './check-documentation';
import {
  checkDocumentationIntegrity,
  type DocumentationIntegrityInput,
} from './documentation-integrity';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const validFiles = new Map([
  [
    'docs/README.md',
    '# Dokumentation\n\n[Entwicklung](./development/README.md)\n\n[ADRs](./adr/README.md)\n',
  ],
  ['docs/development/README.md', '# Entwicklung\n\n[Setup](./setup.md)\n'],
  ['docs/development/setup.md', '# Setup\n\n[Zurück](./README.md)\n'],
  ['docs/adr/README.md', '# ADRs\n\n[ADR 001](./ADR-001-test.md)\n'],
  ['docs/adr/ADR-001-test.md', '# ADR 001\n'],
  ['scripts/example.ts', 'export {};\n'],
  ['docs/api/iam.yaml', 'openapi: 3.1.0\n'],
]);

const createInput = (
  overrides: Partial<DocumentationIntegrityInput> = {}
): DocumentationIntegrityInput => ({
  files: validFiles,
  manifestEntries: ['docs/README.md', ':(glob)docs/development/**', ':(glob)docs/adr/**'],
  publishedPaths: new Set([...validFiles.keys()].filter((path) => path.startsWith('docs/'))),
  trackedPaths: new Set(validFiles.keys()),
  wikiWorkflow: '- [Dokumentation](docs/README.md)\n- [ADRs](docs/adr/README.md)\n',
  ...overrides,
});

describe('documentation integrity', () => {
  it('accepts a completely indexed current documentation graph', () => {
    expect(checkDocumentationIntegrity(createInput())).toEqual([]);
  });

  it('reports missing relative link targets with source line', () => {
    const files = new Map(validFiles);
    files.set('docs/development/setup.md', '# Setup\n\n[Fehlt](./missing.md)\n');

    expect(checkDocumentationIntegrity(createInput({ files }))).toContainEqual({
      code: 'broken-link',
      line: 3,
      path: 'docs/development/setup.md',
      reason: 'relatives Linkziel fehlt: ./missing.md',
    });
  });

  it('reports published pages that are not reachable from the documentation entrypoint', () => {
    const files = new Map(validFiles);
    files.set('docs/development/README.md', '# Entwicklung\n');

    expect(checkDocumentationIntegrity(createInput({ files }))).toContainEqual({
      code: 'unreachable-page',
      line: 1,
      path: 'docs/development/setup.md',
      reason: 'nicht von docs/README.md über Bereichsindizes erreichbar',
    });
  });

  it('reports ADR files missing from the canonical index', () => {
    const files = new Map(validFiles);
    files.set('docs/adr/README.md', '# ADRs\n');

    expect(checkDocumentationIntegrity(createInput({ files }))).toContainEqual({
      code: 'adr-index-mismatch',
      line: 1,
      path: 'docs/adr/README.md',
      reason: 'ADR-Datei fehlt im kanonischen Index: docs/adr/ADR-001-test.md',
    });
  });

  it('reports excluded publication paths in the manifest', () => {
    expect(
      checkDocumentationIntegrity(
        createInput({
          manifestEntries: [
            'docs/README.md',
            ':(glob)docs/development/**',
            ':(glob)docs/user-documentation/**',
          ],
        })
      )
    ).toContainEqual({
      code: 'invalid-manifest',
      line: 3,
      path: 'config/documentation/wiki-publication-paths.txt',
      reason: 'ausgeschlossener Pfad wird publiziert: docs/user-documentation/',
    });
  });

  it('reports Wiki links to legacy ADRs and unpublished documentation', () => {
    const issues = checkDocumentationIntegrity(
      createInput({
        wikiWorkflow:
          '- [Legacy](docs/architecture/decisions/ADR-001.md)\n- [Intern](docs/reports/audit.md)\n',
      })
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'wiki-legacy-link', line: 1 }),
        expect.objectContaining({ code: 'publication-boundary', line: 2 }),
      ])
    );
  });

  it('resolves reference-style Markdown links', () => {
    const files = new Map(validFiles);
    files.set(
      'docs/development/README.md',
      '# Entwicklung\n\n[Setup][setup]\n\n[setup]: ./setup.md\n'
    );

    expect(checkDocumentationIntegrity(createInput({ files }))).toEqual([]);
  });

  it('accepts links to tracked repository code and published directories', () => {
    const files = new Map(validFiles);
    files.set(
      'docs/development/setup.md',
      '# Setup\n\n[Script](../../scripts/example.ts)\n\n[API](../api/)\n'
    );

    expect(checkDocumentationIntegrity(createInput({ files }))).toEqual([]);
  });

  it('formats CLI findings as path, line and repair reason', () => {
    expect(
      formatDocumentationIssue({
        code: 'broken-link',
        line: 7,
        path: 'docs/development/setup.md',
        reason: 'relatives Linkziel fehlt: ./missing.md',
      })
    ).toBe('docs/development/setup.md:7: relatives Linkziel fehlt: ./missing.md');
  });

  it('keeps the gate blocking in test:ci and Repository Hygiene', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };
    const workflow = readFileSync(
      path.join(workspaceRoot, '.github/workflows/repository-hygiene.yml'),
      'utf8'
    );

    expect(packageJson.scripts['check:docs']).toBe('tsx scripts/ci/check-documentation.ts');
    expect(packageJson.scripts['test:ci']).toContain('pnpm check:docs');
    expect(workflow).toContain('name: Documentation Integrity');
    expect(workflow).toContain('run: pnpm check:docs');
    expect(workflow).not.toContain('continue-on-error: true\n        run: pnpm check:docs');
  });
});
