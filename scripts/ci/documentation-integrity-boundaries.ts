import {
  EXCLUDED_PUBLICATION_PREFIXES,
  type DocumentationIntegrityInput,
  type DocumentationIssue,
} from './documentation-integrity-contract';

const checkManifest = (input: DocumentationIntegrityInput): DocumentationIssue[] => {
  const issues: DocumentationIssue[] = [];
  for (const [index, entry] of input.manifestEntries.entries()) {
    if (entry === '' || entry !== entry.trim() || entry.startsWith('#')) {
      issues.push({
        code: 'invalid-manifest',
        line: index + 1,
        path: 'config/documentation/wiki-publication-paths.txt',
        reason:
          'Manifestzeile muss ein nicht leerer Pathspec ohne Rand-Whitespace oder Kommentar sein',
      });
      continue;
    }
    const normalizedEntry = entry.replace(/^:\(glob\)/u, '');
    const excludedPrefix = EXCLUDED_PUBLICATION_PREFIXES.find((prefix) =>
      normalizedEntry.startsWith(prefix)
    );
    if (excludedPrefix) {
      issues.push({
        code: 'invalid-manifest',
        line: index + 1,
        path: 'config/documentation/wiki-publication-paths.txt',
        reason: `ausgeschlossener Pfad wird publiziert: ${excludedPrefix}`,
      });
    }
  }
  for (const publishedPath of input.publishedPaths) {
    if (EXCLUDED_PUBLICATION_PREFIXES.some((prefix) => publishedPath.startsWith(prefix))) {
      issues.push({
        code: 'publication-boundary',
        line: 1,
        path: publishedPath,
        reason: 'ausgeschlossener Pfad ist Teil der Wiki-Publikation',
      });
    }
  }
  return issues;
};

const checkWikiLinks = (input: DocumentationIntegrityInput): DocumentationIssue[] => {
  const issues: DocumentationIssue[] = [];
  const linkPattern = /\[[^\]]+\]\(([^)\s]+)(?:\s+[^)]*)?\)/gu;
  for (const match of input.wikiWorkflow.matchAll(linkPattern)) {
    const rawTarget = match[1];
    const target = rawTarget?.replace(/^\.\//u, '');
    if (!target?.startsWith('docs/')) {
      continue;
    }
    const line = input.wikiWorkflow.slice(0, match.index).split('\n').length;
    const legacyAdr = target.startsWith('docs/architecture/decisions/');
    if (legacyAdr || !input.publishedPaths.has(target)) {
      issues.push({
        code: legacyAdr ? 'wiki-legacy-link' : 'publication-boundary',
        line,
        path: '.github/workflows/wiki-sync.yml',
        reason: legacyAdr
          ? `Wiki verweist auf Legacy-ADR-Pfad: ${target}`
          : `Wiki-Link liegt außerhalb des Publikationsmanifests: ${target}`,
      });
    }
  }
  return issues;
};

const checkWikiWorkflow = (input: DocumentationIntegrityInput): DocumentationIssue[] => {
  if (!input.validateWikiNavigation) {
    return [];
  }
  const issues: DocumentationIssue[] = [];
  const requiredFragments = [
    'uses: ./.github/actions/setup-pnpm-workspace',
    'pnpm check:docs',
    'pnpm exec tsx scripts/ci/build-wiki-publication.ts --output wiki',
  ] as const;
  for (const fragment of requiredFragments) {
    if (!input.wikiWorkflow.includes(fragment)) {
      issues.push({
        code: 'wiki-publication',
        line: 1,
        path: '.github/workflows/wiki-sync.yml',
        reason: `Wiki-Workflow verwendet den gerenderten Publikationspfad nicht: ${fragment}`,
      });
    }
  }
  for (const forbiddenFragment of ['wiki/docs', '](/docs/', '](docs/'] as const) {
    const index = input.wikiWorkflow.indexOf(forbiddenFragment);
    if (index >= 0) {
      issues.push({
        code: 'wiki-publication',
        line: input.wikiWorkflow.slice(0, index).split('\n').length,
        path: '.github/workflows/wiki-sync.yml',
        reason: `Wiki-Workflow enthält verschachtelten Raw-Pfad: ${forbiddenFragment}`,
      });
    }
  }
  return issues;
};

export const checkDocumentationBoundaries = (
  input: DocumentationIntegrityInput
): DocumentationIssue[] => [
  ...checkManifest(input),
  ...checkWikiLinks(input),
  ...checkWikiWorkflow(input),
];
