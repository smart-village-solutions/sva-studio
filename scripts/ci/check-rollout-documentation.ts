#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RolloutDocument {
  readonly path: string;
  readonly content: string;
}

const canonicalPath = 'docs/guides/studio-rollout-process.md';
const historicalPrefixes = [
  'concepts/',
  'docs/pr/',
  'docs/reports/',
  'docs/staging/',
  'docs/superpowers/',
  'openspec/changes/archive/',
] as const;
const requiredCanonicalFragments = [
  'Status: **verbindlicher Betriebsvertrag**',
  '| Dev | `studio-dev` | `https://studio-dev.smart-village.app`',
  '| Staging | `studio-staging` | `https://studio-staging.smart-village.app`',
  '| Production | `studio` | `https://studio.smart-village.app`',
  '`studio-db-backup-staging`',
  '`studio-db-backup-production`',
  'bis zu fünf Minuten',
  'Ausschließlich `.github/workflows/build.yml` darf das reguläre Studio-App-Image veröffentlichen',
  'Backup → Migration → Bootstrap → Postconditions → App-Deploy → Runtime-Smoke → Digest-Prüfung',
] as const;
const requiredReferences = [
  'AGENTS.md',
  'README.md',
  '.github/agents/rollout-operator.agent.md',
  'docs/README.md',
  'docs/architecture/07-deployment-view.md',
  'docs/architecture/08-cross-cutting-concepts.md',
  'docs/development/runtime-profile-betrieb.md',
  'docs/guides/deployment-overview.md',
  'docs/guides/swarm-deployment-guide.md',
  'docs/guides/swarm-deployment-runbook.md',
  'openspec/project.md',
] as const;
const forbiddenCurrentClaims = [
  {
    name: 'lokaler Release als kanonischer Pfad',
    pattern: /kanonisch.{0,160}env:release:studio:local|env:release:studio:local.{0,160}(kanonisch|standard|offiziell|empfohlen)/isu,
  },
  {
    name: 'GitHub nur als Build-/Verify-Vorstufe',
    pattern: /GitHub Actions (?:liefert|liefern|dient|dienen) nur.{0,160}(?:Build|Verify)/isu,
  },
  {
    name: 'GitHub-Deploy als Legacy-Fallback',
    pattern: /(?:CI|GitHub|Runner).{0,100}(?:Deploy|Rollout).{0,100}Legacy-Fallback/isu,
  },
  {
    name: 'gesperrte Production-run-Modi',
    pattern: /Production.{0,160}gesperrte[nr]? `run`-Modi/isu,
  },
  {
    name: 'veralteter Studio-Stackname',
    pattern: /(?:Swarm-Stack.{0,40}sva-studio|--stack\s+sva-studio|sva-studio_app)/isu,
  },
  {
    name: 'veralteter separater Studio-Image-Build',
    pattern: /Studio Image Build.{0,120}(?:muss|liefert|baut|kanonisch|offiziell)/isu,
  },
  {
    name: 'lokales Release-Gate als Pflicht vor dem Rollout',
    pattern: /vor (?:einem )?Studio-Rollout.{0,120}test:release:studio/isu,
  },
] as const;

const isCurrentDocumentation = (path: string): boolean =>
  path.endsWith('.md') && !historicalPrefixes.some((prefix) => path.startsWith(prefix));

export const checkRolloutDocumentation = (documents: readonly RolloutDocument[]): readonly string[] => {
  const byPath = new Map(documents.map((document) => [document.path, document.content]));
  const violations: string[] = [];
  const canonical = byPath.get(canonicalPath);

  if (canonical === undefined) {
    violations.push(`${canonicalPath}: kanonisches Rollout-Dokument fehlt`);
  } else {
    for (const fragment of requiredCanonicalFragments) {
      if (!canonical.includes(fragment)) {
        violations.push(`${canonicalPath}: Pflichtaussage fehlt: ${fragment}`);
      }
    }
  }

  for (const path of requiredReferences) {
    const content = byPath.get(path);
    if (content === undefined) {
      violations.push(`${path}: erwartete Dokumentationsdatei fehlt`);
    } else if (!content.includes('studio-rollout-process.md')) {
      violations.push(`${path}: Verweis auf studio-rollout-process.md fehlt`);
    }
  }

  for (const document of documents.filter(({ path }) => isCurrentDocumentation(path))) {
    for (const claim of forbiddenCurrentClaims) {
      if (claim.pattern.test(document.content)) {
        violations.push(`${document.path}: veraltete Rollout-Aussage (${claim.name})`);
      }
    }
  }

  return violations;
};

const main = (): void => {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .map((path) => path.trim())
    .filter((path) => path.length > 0 && existsSync(resolve(root, path)));
  const documents = paths.map((path) => ({ path, content: readFileSync(resolve(root, path), 'utf8') }));
  const violations = checkRolloutDocumentation(documents);

  if (violations.length > 0) {
    process.stderr.write(`Rollout-Dokumentation ist inkonsistent:\n${violations.map((violation) => `- ${violation}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Rollout-Dokumentation ist konsistent (${documents.length} Markdown-Dateien geprüft).\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
