import type { DocumentationIssue } from './documentation-integrity-contract';
import { parseMarkdownLinks } from './documentation-integrity-markdown';

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

interface NavigationOptions {
  repositoryUrl: string;
  sourceBranch: string;
}

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

export const createWikiHome = (
  slugs: ReadonlyMap<string, string>,
  issues: DocumentationIssue[],
  options: NavigationOptions
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

export const createWikiSidebar = (
  slugs: ReadonlyMap<string, string>,
  issues: DocumentationIssue[]
): string =>
  [
    '- [Home](Home)',
    '- [Aufgaben](Home#was-möchtest-du-tun)',
    ...SIDEBAR_TARGETS.map(
      ([label, sourcePath]) => `- ${wikiLink(label, sourcePath, slugs, issues, '_Sidebar.md')}`
    ),
  ].join('\n') + '\n';

export const validateWikiNavigation = (
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
      const target = link.url.split(/[?#]/u, 1)[0];
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
