import path from 'node:path';

import type { Definition, Image, ImageReference, Link, LinkReference, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface MarkdownLink {
  line: number;
  url: string;
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

export const parseMarkdownLinks = (content: string): MarkdownLink[] => {
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
  return links;
};

export const resolveLinkTarget = (
  sourcePath: string,
  url: string,
  trackedPaths: ReadonlySet<string>
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
  const directoryIndex = path.posix.join(resolved, 'README.md');
  return trackedPaths.has(directoryIndex) ? directoryIndex : resolved;
};

export const collectDirectories = (paths: ReadonlySet<string>): Set<string> => {
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
