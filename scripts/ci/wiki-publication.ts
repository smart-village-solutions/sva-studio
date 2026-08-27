import type { Definition, Image, ImageReference, Link, LinkReference, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type {
  DocumentationIntegrityInput,
  DocumentationIssue,
} from './documentation-integrity-contract';
import { collectDirectories, resolveLinkTarget } from './documentation-integrity-markdown';
import {
  createWikiHome,
  createWikiSidebar,
  validateWikiNavigation,
} from './wiki-publication-navigation';

const DEFAULT_REPOSITORY_URL = 'https://github.com/smart-village-solutions/sva-studio';
const DEFAULT_SOURCE_BRANCH = 'main';
const SOURCE_ARTIFACT_LABEL = ' (Quellartefakt)';

const markdownProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
  bullet: '-',
  fences: true,
  listItemIndent: 'one',
});

export interface WikiPublicationOptions {
  repositoryUrl?: string;
  sourceBranch?: string;
}

export interface WikiPublication {
  files: ReadonlyMap<string, string>;
  slugs: ReadonlyMap<string, string>;
}

export interface WikiPublicationResult {
  issues: DocumentationIssue[];
  publication?: WikiPublication;
}

interface ResolvedWikiLink {
  artifact: boolean;
  url: string;
}

interface RewriteContext {
  directories: ReadonlySet<string>;
  input: DocumentationIntegrityInput;
  issues: DocumentationIssue[];
  options: Required<WikiPublicationOptions>;
  slugs: ReadonlyMap<string, string>;
  sourcePath: string;
}

const normalizeSlugPart = (value: string): string =>
  value
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

export const wikiSlugForPath = (repositoryPath: string): string => {
  if (!repositoryPath.startsWith('docs/') || !repositoryPath.endsWith('.md')) {
    throw new Error(`Wiki-Slugs sind nur für Markdown unter docs/ zulässig: ${repositoryPath}`);
  }
  const relativePath = repositoryPath.slice('docs/'.length, -'.md'.length);
  const parts = relativePath.split('/');
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error(`Markdown-Pfad besitzt keinen Dateinamen: ${repositoryPath}`);
  }
  if (fileName.toLowerCase() !== 'readme') {
    parts.push(fileName);
  }
  const slug = parts.map(normalizeSlugPart).filter(Boolean).join('--');
  return slug || 'dokumentation';
};

const encodeRepositoryPath = (repositoryPath: string): string =>
  repositoryPath.split('/').map(encodeURIComponent).join('/');

const repositoryBlobUrl = (
  options: Required<WikiPublicationOptions>,
  repositoryPath: string
): string =>
  `${options.repositoryUrl}/blob/${encodeURIComponent(options.sourceBranch)}/${encodeRepositoryPath(repositoryPath)}`;

const repositoryTreeUrl = (
  options: Required<WikiPublicationOptions>,
  repositoryPath: string
): string =>
  `${options.repositoryUrl}/tree/${encodeURIComponent(options.sourceBranch)}/${encodeRepositoryPath(repositoryPath)}`;

const repositoryRawUrl = (
  options: Required<WikiPublicationOptions>,
  repositoryPath: string
): string =>
  `${options.repositoryUrl}/raw/${encodeURIComponent(options.sourceBranch)}/${encodeRepositoryPath(repositoryPath)}`;

const splitLinkSuffix = (url: string): { path: string; suffix: string } => {
  const suffixIndex = url.search(/[?#]/u);
  return suffixIndex < 0
    ? { path: url, suffix: '' }
    : { path: url.slice(0, suffixIndex), suffix: url.slice(suffixIndex) };
};

const resolveWikiLink = (
  url: string,
  line: number,
  image: boolean,
  context: RewriteContext
): ResolvedWikiLink => {
  const target = resolveLinkTarget(context.sourcePath, url, context.input.trackedPaths);
  if (!target) {
    return { artifact: false, url };
  }
  const { suffix } = splitLinkSuffix(url);
  if (!context.input.trackedPaths.has(target) && !context.directories.has(target)) {
    context.issues.push({
      code: 'wiki-publication',
      line,
      path: context.sourcePath,
      reason: `Wiki-Link kann nicht transformiert werden: ${url}`,
    });
    return { artifact: false, url };
  }
  if (image) {
    return {
      artifact: false,
      url: `${repositoryRawUrl(context.options, target)}${suffix}`,
    };
  }
  const slug = context.slugs.get(target);
  if (slug) {
    return { artifact: false, url: `${slug}${suffix}` };
  }
  return {
    artifact: !context.directories.has(target),
    url: `${
      context.directories.has(target)
        ? repositoryTreeUrl(context.options, target)
        : repositoryBlobUrl(context.options, target)
    }${suffix}`,
  };
};

const appendArtifactLabel = (node: Link | LinkReference): void => {
  const lastChild = node.children.at(-1);
  if (lastChild?.type === 'text' && lastChild.value.endsWith(SOURCE_ARTIFACT_LABEL)) {
    return;
  }
  node.children.push({ type: 'text', value: SOURCE_ARTIFACT_LABEL });
};

const rewriteMarkdown = (content: string, context: RewriteContext): string => {
  const tree = markdownProcessor.parse(content) as Root;
  const definitions = new Map<string, Definition>();

  visit(tree, 'definition', (node: Definition) => {
    const identifier = node.identifier.toLowerCase();
    if (!definitions.has(identifier)) {
      definitions.set(identifier, node);
    }
  });
  visit(tree, 'link', (node: Link) => {
    const resolved = resolveWikiLink(node.url, node.position?.start.line ?? 1, false, context);
    node.url = resolved.url;
    if (resolved.artifact) {
      node.title = 'Quellartefakt im Repository';
      appendArtifactLabel(node);
    }
  });
  visit(tree, 'image', (node: Image) => {
    node.url = resolveWikiLink(node.url, node.position?.start.line ?? 1, true, context).url;
  });
  visit(tree, 'linkReference', (node: LinkReference) => {
    const definition = definitions.get(node.identifier.toLowerCase());
    if (!definition) {
      return;
    }
    const resolved = resolveWikiLink(
      definition.url,
      node.position?.start.line ?? definition.position?.start.line ?? 1,
      false,
      context
    );
    const directLink = node as unknown as Link;
    const referenceProperties = directLink as unknown as Record<string, unknown>;
    directLink.type = 'link';
    directLink.url = resolved.url;
    directLink.title = resolved.artifact ? 'Quellartefakt im Repository' : definition.title;
    delete referenceProperties.identifier;
    delete referenceProperties.label;
    delete referenceProperties.referenceType;
    if (resolved.artifact) {
      appendArtifactLabel(directLink);
    }
  });
  visit(tree, 'imageReference', (node: ImageReference) => {
    const definition = definitions.get(node.identifier.toLowerCase());
    if (!definition) {
      return;
    }
    const directImage = node as unknown as Image;
    const referenceProperties = directImage as unknown as Record<string, unknown>;
    directImage.type = 'image';
    directImage.url = resolveWikiLink(
      definition.url,
      node.position?.start.line ?? definition.position?.start.line ?? 1,
      true,
      context
    ).url;
    directImage.title = definition.title;
    delete referenceProperties.identifier;
    delete referenceProperties.label;
    delete referenceProperties.referenceType;
  });
  tree.children = tree.children.filter((node) => node.type !== 'definition');

  const sourceUrl = repositoryBlobUrl(context.options, context.sourcePath);
  const sourceNotice = `> Automatisch aus [\`${context.sourcePath}\`](${sourceUrl}) veröffentlicht. Änderungen bitte im Repository vornehmen.\n\n`;
  return `${sourceNotice}${markdownProcessor.stringify(tree)}`;
};

const createSlugMap = (
  input: DocumentationIntegrityInput,
  issues: DocumentationIssue[]
): Map<string, string> => {
  const slugs = new Map<string, string>();
  const pathsBySlug = new Map<string, string>();
  for (const repositoryPath of [...input.publishedPaths].sort()) {
    if (!repositoryPath.endsWith('.md')) {
      continue;
    }
    const slug = wikiSlugForPath(repositoryPath);
    const collision = pathsBySlug.get(slug);
    if (collision) {
      issues.push({
        code: 'wiki-publication',
        line: 1,
        path: repositoryPath,
        reason: `Wiki-Slug-Kollision „${slug}“ mit ${collision}`,
      });
      continue;
    }
    pathsBySlug.set(slug, repositoryPath);
    slugs.set(repositoryPath, slug);
  }
  return slugs;
};

export const buildWikiPublication = (
  input: DocumentationIntegrityInput,
  providedOptions: WikiPublicationOptions = {}
): WikiPublicationResult => {
  const options: Required<WikiPublicationOptions> = {
    repositoryUrl: providedOptions.repositoryUrl ?? DEFAULT_REPOSITORY_URL,
    sourceBranch: providedOptions.sourceBranch ?? DEFAULT_SOURCE_BRANCH,
  };
  const issues: DocumentationIssue[] = [];
  const slugs = createSlugMap(input, issues);
  const files = new Map<string, string>();
  const directories = collectDirectories(input.trackedPaths);

  for (const [sourcePath, slug] of slugs) {
    const content = input.files.get(sourcePath);
    if (content === undefined) {
      issues.push({
        code: 'wiki-publication',
        line: 1,
        path: sourcePath,
        reason: 'publizierte Markdown-Datei kann nicht für das Wiki gelesen werden',
      });
      continue;
    }
    files.set(
      `${slug}.md`,
      rewriteMarkdown(content, { directories, input, issues, options, slugs, sourcePath })
    );
  }

  if (input.validateWikiNavigation) {
    files.set('Home.md', createWikiHome(slugs, issues, options));
    files.set('_Sidebar.md', createWikiSidebar(slugs, issues));
    validateWikiNavigation(files, slugs, issues);
  }

  return issues.length === 0 ? { issues, publication: { files, slugs } } : { issues };
};
