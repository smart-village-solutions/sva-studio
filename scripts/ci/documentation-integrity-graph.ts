import {
  ADR_INDEX_PATH,
  DOCUMENTATION_ENTRYPOINT,
  type DocumentationIntegrityInput,
  type DocumentationIssue,
} from './documentation-integrity-contract';
import {
  collectDirectories,
  type MarkdownLink,
  parseMarkdownLinks,
  resolveLinkTarget,
} from './documentation-integrity-markdown';

interface DocumentationGraph {
  graph: ReadonlyMap<string, ReadonlySet<string>>;
  issues: DocumentationIssue[];
  parsedFiles: ReadonlyMap<string, readonly MarkdownLink[]>;
  publishedMarkdown: ReadonlySet<string>;
}

const isDocumentationIndex = (repositoryPath: string): boolean =>
  repositoryPath === DOCUMENTATION_ENTRYPOINT || repositoryPath.endsWith('/README.md');

const documentationArea = (repositoryPath: string): string | undefined =>
  repositoryPath.match(/^docs\/([^/]+)\//u)?.[1];

const isOwnedNavigationTarget = (sourcePath: string, targetPath: string): boolean => {
  const targetArea = documentationArea(targetPath);
  return (
    sourcePath === DOCUMENTATION_ENTRYPOINT ||
    (targetArea !== undefined && documentationArea(sourcePath) === targetArea)
  );
};

const inspectPublishedMarkdown = (input: DocumentationIntegrityInput): DocumentationGraph => {
  const issues: DocumentationIssue[] = [];
  const publishedMarkdown = new Set(
    [...input.publishedPaths].filter((repositoryPath) => repositoryPath.endsWith('.md'))
  );
  const trackedDirectories = collectDirectories(input.trackedPaths);
  const publishedDirectories = collectDirectories(input.publishedPaths);
  const graph = new Map<string, Set<string>>();
  const parsedFiles = new Map<string, MarkdownLink[]>();

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
    const links = parseMarkdownLinks(content);
    parsedFiles.set(sourcePath, links);
    const reachableTargets = new Set<string>();
    graph.set(sourcePath, reachableTargets);
    for (const link of links) {
      const target = resolveLinkTarget(sourcePath, link.url, input.trackedPaths);
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
      } else if (
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
      } else if (
        link.navigation &&
        isDocumentationIndex(sourcePath) &&
        isOwnedNavigationTarget(sourcePath, target) &&
        publishedMarkdown.has(target)
      ) {
        reachableTargets.add(target);
      }
    }
  }
  return { graph, issues, parsedFiles, publishedMarkdown };
};

const checkReachability = (documentationGraph: DocumentationGraph): DocumentationIssue[] => {
  const visited = new Set<string>();
  const queue = documentationGraph.publishedMarkdown.has(DOCUMENTATION_ENTRYPOINT)
    ? [DOCUMENTATION_ENTRYPOINT]
    : [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const target of documentationGraph.graph.get(current) ?? []) {
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }
  return [...documentationGraph.publishedMarkdown]
    .filter((markdownPath) => !visited.has(markdownPath))
    .map((markdownPath) => ({
      code: 'unreachable-page',
      line: 1,
      path: markdownPath,
      reason: `nicht von ${DOCUMENTATION_ENTRYPOINT} über Bereichsindizes erreichbar`,
    }));
};

const checkAdrIndex = (
  input: DocumentationIntegrityInput,
  documentationGraph: DocumentationGraph
): DocumentationIssue[] => {
  const indexedAdrs = new Set<string>();
  for (const link of documentationGraph.parsedFiles.get(ADR_INDEX_PATH) ?? []) {
    const target = resolveLinkTarget(ADR_INDEX_PATH, link.url, input.trackedPaths);
    if (link.navigation && target?.startsWith('docs/adr/ADR-') && target.endsWith('.md')) {
      indexedAdrs.add(target);
    }
  }
  const adrFiles = new Set(
    [...input.trackedPaths].filter(
      (repositoryPath) =>
        repositoryPath.startsWith('docs/adr/ADR-') && repositoryPath.endsWith('.md')
    )
  );
  return [
    ...[...adrFiles]
      .filter((adrPath) => !indexedAdrs.has(adrPath))
      .map((adrPath): DocumentationIssue => ({
        code: 'adr-index-mismatch',
        line: 1,
        path: ADR_INDEX_PATH,
        reason: `ADR-Datei fehlt im kanonischen Index: ${adrPath}`,
      })),
    ...[...indexedAdrs]
      .filter((adrPath) => !adrFiles.has(adrPath))
      .map((adrPath): DocumentationIssue => ({
        code: 'adr-index-mismatch',
        line: 1,
        path: ADR_INDEX_PATH,
        reason: `ADR-Index verweist auf nicht vorhandene Datei: ${adrPath}`,
      })),
  ];
};

export const checkDocumentationGraph = (
  input: DocumentationIntegrityInput
): DocumentationIssue[] => {
  const documentationGraph = inspectPublishedMarkdown(input);
  return [
    ...documentationGraph.issues,
    ...checkReachability(documentationGraph),
    ...checkAdrIndex(input, documentationGraph),
  ];
};
