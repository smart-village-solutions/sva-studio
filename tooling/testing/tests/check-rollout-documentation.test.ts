import { describe, expect, it } from 'vitest';

import {
  checkRolloutDocumentation,
  type RolloutDocument,
} from '../../../scripts/ci/check-rollout-documentation.js';

const canonical = `
Status: **verbindlicher Betriebsvertrag**
| Dev | \`studio-dev\` | \`https://studio-dev.smart-village.app\`
| Staging | \`studio-staging\` | \`https://studio-staging.smart-village.app\`
| Production | \`studio\` | \`https://studio.smart-village.app\`
\`studio-db-backup-staging\`
\`studio-db-backup-production\`
bis zu fünf Minuten
Ausschließlich \`.github/workflows/build.yml\` darf das reguläre Studio-App-Image veröffentlichen
Backup → Migration → Bootstrap → Postconditions → App-Deploy → Runtime-Smoke → Digest-Prüfung
`;
const requiredPaths = [
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
const validDocuments = (): RolloutDocument[] => [
  { path: 'docs/guides/studio-rollout-process.md', content: canonical },
  ...requiredPaths.map((path) => ({ path, content: 'Siehe studio-rollout-process.md' })),
];

describe('checkRolloutDocumentation', () => {
  it('accepts the canonical contract and all required references', () => {
    expect(checkRolloutDocumentation(validDocuments())).toEqual([]);
  });

  it('rejects a current document that declares the local legacy path canonical', () => {
    const documents = [
      ...validDocuments(),
      { path: 'docs/guides/legacy.md', content: 'Der kanonische Studio-Pfad ist env:release:studio:local.' },
    ];

    expect(checkRolloutDocumentation(documents)).toContain(
      'docs/guides/legacy.md: veraltete Rollout-Aussage (lokaler Release als kanonischer Pfad)',
    );
  });

  it('allows historical reports to preserve their point-in-time evidence', () => {
    const documents = [
      ...validDocuments(),
      { path: 'docs/reports/historical.md', content: 'Der kanonische Studio-Pfad war env:release:studio:local.' },
    ];

    expect(checkRolloutDocumentation(documents)).toEqual([]);
  });

  it('checks active OpenSpec changes but allows archived changes', () => {
    const activePath = 'openspec/changes/update-rollout/design.md';
    const archivedPath = 'openspec/changes/archive/2026-07-31-update-rollout/design.md';
    const legacyClaim = 'GitHub Actions liefern nur Build und Verify.';

    expect(
      checkRolloutDocumentation([
        ...validDocuments(),
        { path: activePath, content: legacyClaim },
        { path: archivedPath, content: legacyClaim },
      ]),
    ).toContain(
      `${activePath}: veraltete Rollout-Aussage (GitHub nur als Build-/Verify-Vorstufe)`,
    );
  });

  it('rejects the obsolete production stack name in current operations documentation', () => {
    const documents = [
      ...validDocuments(),
      { path: 'docs/guides/stack.md', content: 'Der Swarm-Stack `sva-studio` wird aktualisiert.' },
    ];

    expect(checkRolloutDocumentation(documents)).toContain(
      'docs/guides/stack.md: veraltete Rollout-Aussage (veralteter Studio-Stackname)',
    );
  });

  it('rejects the removed standalone image-build workflow as a current requirement', () => {
    const documents = [
      ...validDocuments(),
      {
        path: 'docs/architecture/build.md',
        content: 'Studio Image Build muss genau einen Manifest-Digest liefern.',
      },
    ];

    expect(checkRolloutDocumentation(documents)).toContain(
      'docs/architecture/build.md: veraltete Rollout-Aussage (veralteter separater Studio-Image-Build)',
    );
  });

  it('rejects missing environment and convergence assertions', () => {
    const documents = validDocuments().map((document) =>
      document.path === 'docs/guides/studio-rollout-process.md'
        ? { ...document, content: 'Status: **verbindlicher Betriebsvertrag**' }
        : document,
    );

    expect(checkRolloutDocumentation(documents)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('`studio-db-backup-production`'),
        expect.stringContaining('bis zu fünf Minuten'),
      ]),
    );
  });
});
