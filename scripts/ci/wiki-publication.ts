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
import {
  collectDirectories,
  parseMarkdownLinks,
  resolveLinkTarget,
} from './documentation-integrity-markdown';

const DEFAULT_REPOSITORY_URL = 'https://github.com/smart-village-solutions/sva-studio';
const DEFAULT_SOURCE_BRANCH = 'main';
const SOURCE_ARTIFACT_LABEL = ' (Quellartefakt)';

const TASK_TARGETS = [
  ['Studio lokal einrichten', 'docs/development/README.md'],
  ['Eine Änderung entwickeln und testen', 'docs/development/testing-strategy.md'],
  ['Einen PR vorbereiten oder prüfen', 'docs/development/review-agent-governance.md'],
  ['Studio nach Dev, Staging oder Production ausrollen', 'docs/guides/studio-rollout-process.md'],
  ['Einen Fehler oder Incident untersuchen', 'docs/operations/incident-response.md'],
  ['Architektur und Entscheidungen verstehen', 'docs/architecture/README.md'],
  ['IAM, APIs oder Datenmodelle nachschlagen', 'docs/reference/README.md'],
  ['Dokumentation erstellen oder pflegen', 'docs/development/dokumentations-integritaetsgate.md'],
] as const;

const CRITICAL_TARGETS = [
  ['Kanonischer Studio-Rollout', 'docs/guides/studio-rollout-process.md'],
  ['Incident Response', 'docs/operations/incident-response.md'],
  ['Security Policy', 'docs/governance/security-policy.md'],
  ['Architekturübersicht', 'docs/architecture/README.md'],
  ['Architekturentscheidungen (ADRs)', 'docs/adr/README.md'],
] as const;

const AREA_TARGETS = [
  [
    'Entwicklung',
    'Lokales Setup, Implementierung, Testing und Reviews',
    'docs/development/README.md',
  ],
  ['Betrieb', 'Deployment, Diagnose, Recovery und Runbooks', 'docs/operations/README.md'],
  ['Architektur', 'Systembild, arc42 und technische Zielbilder', 'docs/architecture/README.md'],
  ['ADRs', 'Kanonische und nachvollziehbare Architekturentscheidungen', 'docs/adr/README.md'],
  [
    'Referenz und APIs',
    'Stabile Verträge, Datenmodelle und Nachschlagewerke',
    'docs/reference/README.md',
  ],
  ['Governance', 'Delivery-, Review-, Security- und Projektregeln', 'docs/governance/README.md'],
] as const;

const SIDEBAR_TARGETS = [
  ['Entwicklung', 'docs/development/README.md'],
  ['Betrieb', 'docs/operations/README.md'],
  ['Architektur', 'docs/architecture/README.md'],
  ['ADRs', 'docs/adr/README.md'],
  ['Referenz und APIs', 'docs/reference/README.md'],
  ['Governance', 'docs/governance/README.md'],
  ['Studio-Rollout', 'docs/guides/studio-rollout-process.md'],
  ['Incident Response', 'docs/operations/incident-response.md'],
] as const;

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

const wikiLink = (
  label: string,
  sourcePath: string,
  slugs: ReadonlyMap<string, string>,
  issues: DocumentationIssue[],
  outputPath: 'Home.md' | '_Sidebar.md'
): string => {
  const slug = slugs.get(sourcePath);
  if (!slug) {
    issues.push({
      code: 'wiki-publication',
      line: 1,
      path: outputPath,
      reason: `kanonisches Wiki-Ziel wird nicht publiziert: ${sourcePath}`,
    });
    return `[${label}](fehlendes-wiki-ziel)`;
  }
  return `[${label}](${slug})`;
};

const createHome = (
  slugs: ReadonlyMap<string, string>,
  issues: DocumentationIssue[],
  options: Required<WikiPublicationOptions>
): string => {
  const tasks = TASK_TARGETS.map(
    ([label, sourcePath]) => `- ${wikiLink(label, sourcePath, slugs, issues, 'Home.md')}`
  ).join('\n');
  const critical = CRITICAL_TARGETS.map(
    ([label, sourcePath]) => `- ${wikiLink(label, sourcePath, slugs, issues, 'Home.md')}`
  ).join('\n');
  const areas = AREA_TARGETS.map(
    ([label, description, sourcePath]) =>
      `- **${wikiLink(label, sourcePath, slugs, issues, 'Home.md')}** – ${description}`
  ).join('\n');
  const overview = wikiLink(
    'vollständigen Dokumentationsübersicht',
    'docs/README.md',
    slugs,
    issues,
    'Home.md'
  );
  const developmentRules = `${options.repositoryUrl}/blob/${encodeURIComponent(options.sourceBranch)}/DEVELOPMENT_RULES.md`;
  return `# SVA Studio Wiki

Die lokale Projekt- und Betriebsdokumentation wird automatisch aus dem Studio-Repository veröffentlicht. Die kanonischen Quelldateien bleiben unter \`docs/\`.

## Was möchtest du tun?

${tasks}

## Kritische Einstiege

${critical}
- [Entwicklungsregeln im Repository](${developmentRules})

## Themenbereiche

${areas}

## Suchen und Orientierung

Nutze die Wiki-Suche für bekannte Begriffe. Für einen systematischen Einstieg führen die Aufgabenpfade und Bereichsübersichten schneller zur maßgeblichen Quelle. Eine kuratierte Gesamtübersicht steht in der ${overview}.
`;
};

const createSidebar = (slugs: ReadonlyMap<string, string>, issues: DocumentationIssue[]): string =>
  [
    '- [Home](Home)',
    '- [Aufgaben](Home#was-möchtest-du-tun)',
    ...SIDEBAR_TARGETS.map(
      ([label, sourcePath]) => `- ${wikiLink(label, sourcePath, slugs, issues, '_Sidebar.md')}`
    ),
  ].join('\n') + '\n';

const validateGeneratedNavigation = (
  files: ReadonlyMap<string, string>,
  slugs: ReadonlyMap<string, string>,
  issues: DocumentationIssue[]
): void => {
  const generatedTargets = new Set(['Home', ...slugs.values()]);
  for (const outputPath of ['Home.md', '_Sidebar.md'] as const) {
    const content = files.get(outputPath);
    if (!content) {
      issues.push({
        code: 'wiki-publication',
        line: 1,
        path: outputPath,
        reason: 'Wiki-Navigation wurde nicht erzeugt',
      });
      continue;
    }
    for (const link of parseMarkdownLinks(content)) {
      if (!link.navigation || /^[a-z][a-z\d+.-]*:/iu.test(link.url)) {
        continue;
      }
      const target = splitLinkSuffix(link.url).path;
      if (target && !generatedTargets.has(target)) {
        issues.push({
          code: 'wiki-publication',
          line: link.line,
          path: outputPath,
          reason: `Wiki-Navigation verweist auf nicht erzeugte Seite: ${target}`,
        });
      }
    }
  }
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
    files.set('Home.md', createHome(slugs, issues, options));
    files.set('_Sidebar.md', createSidebar(slugs, issues));
    validateGeneratedNavigation(files, slugs, issues);
  }

  return issues.length === 0 ? { issues, publication: { files, slugs } } : { issues };
};
