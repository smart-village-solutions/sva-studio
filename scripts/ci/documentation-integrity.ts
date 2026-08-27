import path from 'node:path';

import type { Definition, Image, ImageReference, Link, LinkReference, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export const DOCUMENTATION_ENTRYPOINT = 'docs/README.md';
export const ADR_INDEX_PATH = 'docs/adr/README.md';

export const EXCLUDED_PUBLICATION_PREFIXES = [
  'docs/architecture/decisions/',
  'docs/changelog/',
  'docs/pr/',
  'docs/reports/',
  'docs/staging/',
  'docs/superpowers/',
  'docs/user-documentation/',
] as const;

export type DocumentationIssueCode =
  | 'adr-index-mismatch'
  | 'broken-link'
  | 'invalid-manifest'
  | 'publication-boundary'
  | 'unreachable-page'
  | 'wiki-legacy-link';

export interface DocumentationIssue {
  code: DocumentationIssueCode;
  path: string;
  line: number;
  reason: string;
}

export interface DocumentationIntegrityInput {
  files: ReadonlyMap<string, string>;
  manifestEntries: readonly string[];
  publishedPaths: ReadonlySet<string>;
  trackedPaths: ReadonlySet<string>;
  wikiWorkflow: string;
}

interface MarkdownLink {
  line: number;
  url: string;
}

interface ParsedMarkdown {
  links: MarkdownLink[];
}

const markdownParser = unified().use(remarkParse);

const normalizeRepositoryPath = (value: string): string =>
  path.posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//u, '').replace(/\/$/u, '');

const isExternalOrAnchor = (url: string): boolean =>
  url === '' ||
  url.startsWith('#') ||
  url.startsWith('/') ||
  url.startsWith('//') ||
  /^[a-z][a-z\d+.-]*:/iu.test(url);

const stripQueryAndFragment = (url: string): string => url.split(/[?#]/u, 1)[0] ?? '';

const decodeLinkPath = (url: string): string => {
  try {
    return decodeURI(stripQueryAndFragment(url));
  } catch {
    return stripQueryAndFragment(url);
  }
};

const parseMarkdownLinks = (content: string): ParsedMarkdown => {
  const tree = markdownParser.parse(content) as Root;
  const definitions = new Map<string, Definition>();
  const links: MarkdownLink[] = [];

  visit(tree, 'definition', (node: Definition) => {
    definitions.set(node.identifier.toLowerCase(), node);
  });

  visit(tree, ['link', 'image', 'linkReference', 'imageReference'], (node) => {
    const positionedNode = node as Link | Image | LinkReference | ImageReference;
    const line = positionedNode.position?.start.line ?? 1;

    if (positionedNode.type === 'link' || positionedNode.type === 'image') {
      links.push({ line, url: positionedNode.url });
      return;
    }

    const definition = definitions.get(positionedNode.identifier.toLowerCase());
    if (definition) {
      links.push({ line, url: definition.url });
    }
  });

  return { links };
};

const resolveLinkTarget = (
  sourcePath: string,
  url: string,
  trackedPaths: ReadonlySet<string>,
  trackedDirectories: ReadonlySet<string>
): string | undefined => {
  if (isExternalOrAnchor(url)) {
    return undefined;
  }

  const decodedPath = decodeLinkPath(url);
  if (!decodedPath) {
    return undefined;
  }

  const resolved = normalizeRepositoryPath(
    path.posix.join(path.posix.dirname(sourcePath), decodedPath)
  );
  if (trackedPaths.has(resolved)) {
    return resolved;
  }

  const directoryIndex = path.posix.join(resolved, 'README.md');
  if (trackedPaths.has(directoryIndex)) {
    return directoryIndex;
  }

  return trackedDirectories.has(resolved) ? resolved : resolved;
};

const collectDirectories = (paths: ReadonlySet<string>): Set<string> => {
  const directories = new Set<string>();
  for (const repositoryPath of paths) {
    let directory = path.posix.dirname(repositoryPath);
    while (directory !== '.' && !directories.has(directory)) {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  return directories;
};

const isExcludedPublicationPath = (repositoryPath: string): boolean =>
  EXCLUDED_PUBLICATION_PREFIXES.some((prefix) => repositoryPath.startsWith(prefix));

const issueKey = (issue: DocumentationIssue): string =>
  `${issue.path}\u0000${issue.line.toString().padStart(8, '0')}\u0000${issue.code}\u0000${issue.reason}`;

const sortedIssues = (issues: DocumentationIssue[]): DocumentationIssue[] =>
  issues.sort((left, right) => issueKey(left).localeCompare(issueKey(right), 'en'));

const checkManifest = (input: DocumentationIntegrityInput): DocumentationIssue[] => {
  const issues: DocumentationIssue[] = [];

  for (const [index, entry] of input.manifestEntries.entries()) {
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
    if (isExcludedPublicationPath(publishedPath)) {
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
    const target = match[1];
    if (!target?.startsWith('docs/')) {
      continue;
    }

    const line = input.wikiWorkflow.slice(0, match.index).split('\n').length;
    if (target.startsWith('docs/architecture/decisions/')) {
      issues.push({
        code: 'wiki-legacy-link',
        line,
        path: '.github/workflows/wiki-sync.yml',
        reason: `Wiki verweist auf Legacy-ADR-Pfad: ${target}`,
      });
      continue;
    }

    if (!input.publishedPaths.has(target)) {
      issues.push({
        code: 'publication-boundary',
        line,
        path: '.github/workflows/wiki-sync.yml',
        reason: `Wiki-Link liegt außerhalb des Publikationsmanifests: ${target}`,
      });
    }
  }

  return issues;
};

const checkMarkdownGraph = (input: DocumentationIntegrityInput): DocumentationIssue[] => {
  const issues: DocumentationIssue[] = [];
  const publishedMarkdown = new Set(
    [...input.publishedPaths].filter((repositoryPath) => repositoryPath.endsWith('.md'))
  );
  const trackedDirectories = collectDirectories(input.trackedPaths);
  const publishedDirectories = collectDirectories(input.publishedPaths);
  const graph = new Map<string, Set<string>>();
  const parsedFiles = new Map<string, ParsedMarkdown>();

  for (const sourcePath of publishedMarkdown) {
    const content = input.files.get(sourcePath);
    if (content === undefined) {
      issues.push({
        code: 'broken-link',
        line: 1,
        path: sourcePath,
        reason: 'publizierte Markdown-Datei kann nicht gelesen werden',
      });
      continue;
    }

    const parsed = parseMarkdownLinks(content);
    parsedFiles.set(sourcePath, parsed);
    const reachableTargets = new Set<string>();
    graph.set(sourcePath, reachableTargets);

    for (const link of parsed.links) {
      const target = resolveLinkTarget(
        sourcePath,
        link.url,
        input.trackedPaths,
        trackedDirectories
      );
      if (!target) {
        continue;
      }

      if (!input.trackedPaths.has(target) && !trackedDirectories.has(target)) {
        issues.push({
          code: 'broken-link',
          line: link.line,
          path: sourcePath,
          reason: `relatives Linkziel fehlt: ${link.url}`,
        });
        continue;
      }

      if (
        target.startsWith('docs/') &&
        !input.publishedPaths.has(target) &&
        !publishedDirectories.has(target)
      ) {
        issues.push({
          code: 'publication-boundary',
          line: link.line,
          path: sourcePath,
          reason: `relatives Linkziel liegt außerhalb der aktuellen Wiki-Publikation: ${target}`,
        });
        continue;
      }

      if (publishedMarkdown.has(target)) {
        reachableTargets.add(target);
      }
    }
  }

  const visited = new Set<string>();
  const queue = publishedMarkdown.has(DOCUMENTATION_ENTRYPOINT) ? [DOCUMENTATION_ENTRYPOINT] : [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const target of graph.get(current) ?? []) {
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  for (const markdownPath of publishedMarkdown) {
    if (!visited.has(markdownPath)) {
      issues.push({
        code: 'unreachable-page',
        line: 1,
        path: markdownPath,
        reason: `nicht von ${DOCUMENTATION_ENTRYPOINT} über Bereichsindizes erreichbar`,
      });
    }
  }

  const indexedAdrs = new Set<string>();
  for (const link of parsedFiles.get(ADR_INDEX_PATH)?.links ?? []) {
    const target = resolveLinkTarget(
      ADR_INDEX_PATH,
      link.url,
      input.trackedPaths,
      trackedDirectories
    );
    if (target?.startsWith('docs/adr/ADR-') && target.endsWith('.md')) {
      indexedAdrs.add(target);
    }
  }

  const adrFiles = new Set(
    [...input.trackedPaths].filter(
      (repositoryPath) =>
        repositoryPath.startsWith('docs/adr/ADR-') && repositoryPath.endsWith('.md')
    )
  );
  for (const adrPath of adrFiles) {
    if (!indexedAdrs.has(adrPath)) {
      issues.push({
        code: 'adr-index-mismatch',
        line: 1,
        path: ADR_INDEX_PATH,
        reason: `ADR-Datei fehlt im kanonischen Index: ${adrPath}`,
      });
    }
  }
  for (const adrPath of indexedAdrs) {
    if (!adrFiles.has(adrPath)) {
      issues.push({
        code: 'adr-index-mismatch',
        line: 1,
        path: ADR_INDEX_PATH,
        reason: `ADR-Index verweist auf nicht vorhandene Datei: ${adrPath}`,
      });
    }
  }

  return issues;
};

export const checkDocumentationIntegrity = (
  input: DocumentationIntegrityInput
): DocumentationIssue[] =>
  sortedIssues([...checkManifest(input), ...checkWikiLinks(input), ...checkMarkdownGraph(input)]);
