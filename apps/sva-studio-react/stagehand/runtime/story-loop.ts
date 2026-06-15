import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadStagehandStoryCatalogFromFile,
  writeStagehandStoryCheckOverlay,
  type StagehandStoryCheck,
  type StagehandStoryRecord,
} from '../stories/state.js';
import type { StagehandAdminConfig, StagehandStoryCheckStatus, StagehandStoryCoverage } from './types.js';

export interface StagehandStoryCluster {
  readonly id: string;
  readonly reason: string;
  readonly stories: readonly StagehandStoryRecord[];
}

export interface StagehandStoryEvidence {
  readonly coverage: StagehandStoryCoverage;
  readonly findings: readonly string[];
  readonly notes: string;
  readonly status: StagehandStoryCheckStatus;
  readonly storyId: number;
}

export interface StagehandStoryLoopSummary {
  readonly clusters: number;
  readonly storiesClassified: number;
  readonly storiesFailedEvidence: number;
  readonly storiesPassed: number;
  readonly storiesSkipped: number;
}

export interface StagehandStoryLoopResult {
  readonly artifacts: {
    readonly overlayPath: string;
    readonly reportPath: string;
    readonly statusPath: string;
    readonly transcriptPath: string;
  };
  readonly summary: StagehandStoryLoopSummary;
}

export interface RunStagehandStoryLoopOptions {
  readonly executeCluster?: (input: {
    cluster: StagehandStoryCluster;
    stories: readonly StagehandStoryRecord[];
  }) => Promise<readonly StagehandStoryEvidence[]>;
  readonly generatedAt?: string;
  readonly reportsRoot: string;
  readonly storySourcePath: string;
}

interface StoryLoopAggregateStatus {
  readonly generatedAt: string;
  readonly overlayPath: string;
  readonly stories: readonly {
    readonly coverage: StagehandStoryCoverage;
    readonly findings: readonly string[];
    readonly notes: string;
    readonly status: StagehandStoryCheckStatus;
    readonly storyId: number;
  }[];
  readonly summary: StagehandStoryLoopSummary;
  readonly transcriptPath: string;
}

type BrowserModule = typeof import('@playwright/test');

type ApiResponsePayload = {
  readonly data?: {
    readonly invitation?: {
      readonly status?: string;
    };
    readonly user?: {
      readonly id?: string;
    };
  };
  readonly error?: {
    readonly message?: string;
  };
};

const appRequire = createRequire(fileURLToPath(import.meta.url));

function createAggregateArtifacts(reportsRoot: string) {
  const loopDirectory = join(reportsRoot, 'story-loop');

  return {
    overlayPath: join(loopDirectory, 'overlay.json'),
    reportPath: join(loopDirectory, 'report.md'),
    statusPath: join(loopDirectory, 'status.json'),
    transcriptPath: join(loopDirectory, 'transcript.jsonl'),
  };
}

function shouldSkipStory(config: StagehandAdminConfig, story: StagehandStoryRecord): boolean {
  if (config.storyFilters.resume && story.studioCheck.status !== 'offen') {
    return true;
  }

  if (config.storyFilters.storyIds.length > 0 && config.storyFilters.storyIds.includes(story.id) === false) {
    return true;
  }

  if (config.storyFilters.packageIds.length > 0 && config.storyFilters.packageIds.includes(story.packageId) === false) {
    return true;
  }

  return false;
}

function mapStoryToClusterId(story: StagehandStoryRecord): string {
  if (story.id === 18) {
    return 'tenant-user-create';
  }

  if (story.id === 19 || story.packageId === 'IAM-P5') {
    return 'tenant-isolation';
  }

  if (story.packageId === 'IAM-P1') {
    return 'tenant-login-context';
  }

  if (story.packageId === 'IAM-P2') {
    return 'tenant-user-lifecycle';
  }

  if (story.packageId === 'IAM-P3') {
    return 'tenant-user-assignments';
  }

  if (story.packageId === 'IAM-P4') {
    return 'role-and-permission-management';
  }

  if (story.packageId === 'IAM-P6') {
    return 'legal-text-governance';
  }

  return 'audit-and-monitoring';
}

function clusterReason(clusterId: string): string {
  switch (clusterId) {
    case 'tenant-user-create':
      return 'Tenant-Mutationslauf für Nutzeranlage und Sichtbarkeit im Mandantenkontext.';
    case 'tenant-isolation':
      return 'Mandanten- und Sichttrennung erfordert Negativ- und Kontextnachweise.';
    case 'tenant-login-context':
      return 'Login- und Einstiegsszenarien benötigen tenant-spezifischen UI-Kontext.';
    case 'tenant-user-lifecycle':
      return 'Onboarding- und Lebenszykluspfade laufen über tenant-nahe Nutzerverwaltung.';
    case 'tenant-user-assignments':
      return 'Organisations- und Bereichszuordnungen sind tenantgebundene Admin-Flows.';
    case 'role-and-permission-management':
      return 'Rollen-, Gruppen- und Rechtebeweise erfordern dedizierte Admin-Oberflächen.';
    case 'legal-text-governance':
      return 'Rechtstexte und Zustimmungen sind separate Governance-Flows.';
    default:
      return 'Audit-, Monitoring- oder Betriebsnachweise liegen nicht direkt in einer lokalen UI vor.';
  }
}

function buildClusters(config: StagehandAdminConfig, stories: readonly StagehandStoryRecord[]): StagehandStoryCluster[] {
  const grouped = new Map<string, StagehandStoryRecord[]>();

  for (const story of stories) {
    if (shouldSkipStory(config, story)) {
      continue;
    }

    const clusterId = mapStoryToClusterId(story);

    if (config.storyFilters.clusters.length > 0 && config.storyFilters.clusters.includes(clusterId) === false) {
      continue;
    }

    grouped.set(clusterId, [...(grouped.get(clusterId) ?? []), story]);
  }

  return [...grouped.entries()].map(([id, clusterStories]) => ({
    id,
    reason: clusterReason(id),
    stories: clusterStories.sort((left, right) => left.id - right.id),
  }));
}

function defaultEvidenceForCluster(cluster: StagehandStoryCluster): readonly StagehandStoryEvidence[] {
  return cluster.stories.map((story) => ({
    storyId: story.id,
    status: cluster.id === 'audit-and-monitoring' || cluster.id === 'legal-text-governance' ? 'umgebung_unzureichend' : 'unklar',
    coverage: 'nachweis_fehlend',
    notes: `Cluster ${cluster.id}: ${cluster.reason}`,
    findings: [
      'Für diese Story existiert im aktuellen lokalen Stagehand-Ausbau noch kein belastbarer Vollnachweis.',
      `Grund: ${cluster.reason}`,
    ],
  }));
}

async function loadChromium() {
  return (appRequire('@playwright/test') as BrowserModule).chromium;
}

async function fillIfVisible(page: import('@playwright/test').Page, selectors: readonly string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);

    if (count === 0) {
      continue;
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    if (isVisible === false) {
      continue;
    }

    await first.fill(value);
    return true;
  }

  return false;
}

async function clickIfVisible(
  page: import('@playwright/test').Page,
  selectors: readonly ({ kind: 'css'; value: string } | { kind: 'role'; value: string | RegExp })[]
): Promise<boolean> {
  for (const selector of selectors) {
    const locator =
      selector.kind === 'css' ? page.locator(selector.value) : page.getByRole('button', { name: selector.value });
    const count = await locator.count().catch(() => 0);

    if (count === 0) {
      continue;
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    if (isVisible === false) {
      continue;
    }

    await first.click();
    return true;
  }

  return false;
}

async function performKeycloakLogin(
  page: import('@playwright/test').Page,
  credentials: { password: string; username: string }
): Promise<void> {
  const usernameFilled = await fillIfVisible(page, ['input[name="username"]', '#username'], credentials.username);
  const passwordFilled = await fillIfVisible(page, ['input[name="password"]', '#password'], credentials.password);

  if (usernameFilled === false || passwordFilled === false) {
    throw new Error('Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.');
  }

  const clicked = await clickIfVisible(page, [
    { kind: 'css', value: '#kc-login' },
    { kind: 'role', value: /anmelden|sign in|login/i },
  ]);

  if (clicked === false) {
    throw new Error('Der Keycloak-Login-Button wurde nicht gefunden.');
  }
}

function createMutationHeaders(baseUrl: string, idempotencyKey: string): Record<string, string> {
  const origin = new URL(baseUrl).origin;

  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: origin,
    Referer: `${origin}/`,
    'Idempotency-Key': idempotencyKey,
  };
}

async function executeTenantUserCreateCluster(
  config: StagehandAdminConfig,
  cluster: StagehandStoryCluster
): Promise<readonly StagehandStoryEvidence[]> {
  if (config.tenant === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes: 'Tenant-Konfiguration fehlt; Story kann lokal nicht automatisch geprüft werden.',
    }));
  }

  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  const uniqueSuffix = timestamp.slice(-6);
  const email = `stagehand.story18.${timestamp}@example.invalid`;
  const firstName = 'Stagehand';
  const lastName = `Loop${uniqueSuffix}`;
  const displayName = `${firstName} ${lastName}`;
  const idempotencyKey = `stagehand-story18-${timestamp}`;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(new URL('/auth/login', config.tenant.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(page, config.tenant.admin);
    await page.waitForURL(new RegExp(`${config.tenant.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`), {
      timeout: 45_000,
    });
    await page.waitForLoadState('networkidle');

    const response = await context.request.post(new URL('/api/v1/iam/users', config.tenant.baseUrl).toString(), {
      data: {
        email,
        firstName,
        lastName,
        displayName,
        roleIds: [],
        sendPasswordSetupEmail: false,
      },
      failOnStatusCode: false,
      headers: createMutationHeaders(config.tenant.baseUrl, idempotencyKey),
    });
    const responsePayload = (await response.json().catch(() => ({}))) as ApiResponsePayload;

    if (response.status() !== 201 || responsePayload.data?.user?.id === undefined) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        status: 'unklar',
        coverage: 'nachweis_fehlend',
        notes:
          responsePayload.error?.message ??
          `Nutzeranlage antwortete mit HTTP ${response.status()} und lieferte keine belastbare User-ID.`,
        findings: [
          `Tenant-Create-Call fehlgeschlagen: HTTP ${response.status()}.`,
          'Die Story konnte lokal nicht positiv nachgewiesen werden.',
        ],
      }));
    }

    const userId = responsePayload.data.user.id;

    await page.goto(new URL(`/admin/users/${userId}`, config.tenant.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');

    if ((pageContent?.includes(email) ?? false) === false || (pageContent?.includes(displayName) ?? false) === false) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        status: 'unklar',
        coverage: 'nachweis_fehlend',
        notes: 'Nutzer wurde erzeugt, konnte aber in der Detailansicht nicht eindeutig nachgewiesen werden.',
        findings: [
          `User-ID ${userId} wurde erstellt, aber Name/E-Mail waren nicht in /admin/users/${userId} sichtbar.`,
        ],
      }));
    }

    return cluster.stories.map((story) => ({
      storyId: story.id,
      status: 'erfuellt',
      coverage: 'vorhanden',
      notes: `Tenant-Nachweis über User ${email} auf ${config.tenant?.baseUrl}/admin/users/${userId}.`,
      findings: [
        `Nutzer ${email} wurde im Tenant erfolgreich angelegt.`,
        `Die Detailansicht /admin/users/${userId} zeigte Name und E-Mail.`,
        `Passwort-Einladung wurde mit Status ${responsePayload.data?.invitation?.status ?? 'not_requested'} verarbeitet.`,
      ],
    }));
  } finally {
    await browser.close();
  }
}

async function executeDefaultCluster(
  config: StagehandAdminConfig,
  cluster: StagehandStoryCluster
): Promise<readonly StagehandStoryEvidence[]> {
  if (cluster.id === 'tenant-user-create') {
    return executeTenantUserCreateCluster(config, cluster);
  }

  return defaultEvidenceForCluster(cluster);
}

function createSummary(
  clusters: readonly StagehandStoryCluster[],
  evidence: readonly StagehandStoryEvidence[],
  skippedStories: number
): StagehandStoryLoopSummary {
  const storiesPassed = evidence.filter((entry) => entry.status === 'erfuellt').length;
  const storiesFailedEvidence = evidence.filter((entry) => entry.status === 'unklar').length;

  return {
    clusters: clusters.length,
    storiesClassified: evidence.length,
    storiesFailedEvidence,
    storiesPassed,
    storiesSkipped: skippedStories,
  };
}

function createAggregateMarkdown(
  generatedAt: string,
  summary: StagehandStoryLoopSummary,
  evidence: readonly StagehandStoryEvidence[],
  stories: ReadonlyMap<number, StagehandStoryRecord>,
  transcriptPath: string
): string {
  return [
    '# Stagehand-Story-Loop',
    '',
    `Erstellt am: \`${generatedAt}\``,
    `Verarbeitete Stories: \`${summary.storiesClassified}\``,
    `Erfüllt: \`${summary.storiesPassed}\``,
    `Unklar / Lücke: \`${summary.storiesFailedEvidence}\``,
    `Umgebung unzureichend: \`${evidence.filter((entry) => entry.status === 'umgebung_unzureichend').length}\``,
    `Übersprungen: \`${summary.storiesSkipped}\``,
    '',
    '## Story-Ergebnisse',
    ...(evidence.length === 0
      ? ['- Keine']
      : evidence.flatMap((entry) => {
          const story = stories.get(entry.storyId);
          const title = story?.story ?? `Story ${entry.storyId}`;

          return [
            `- ${story?.packageId ?? 'IAM'} / Story ${entry.storyId}: ${title}`,
            `  - Status: ${entry.status}`,
            `  - Coverage: ${entry.coverage}`,
            `  - Notes: ${entry.notes}`,
            ...entry.findings.map((finding) => `  - Finding: ${finding}`),
          ];
        })),
    '',
    '## Transkript',
    '```text',
    transcriptPath,
    '```',
  ].join('\n');
}

export async function runStagehandStoryLoop(
  config: StagehandAdminConfig,
  options: RunStagehandStoryLoopOptions
): Promise<StagehandStoryLoopResult> {
  const catalog = loadStagehandStoryCatalogFromFile(options.storySourcePath);
  const stories = [...catalog.storyIndex.values()].sort((left, right) => left.id - right.id);
  const eligibleStories = stories.filter((story) => shouldSkipStory(config, story) === false);
  const clusters = buildClusters(config, stories);
  const storiesCoveredByClusters = new Set(clusters.flatMap((cluster) => cluster.stories.map((story) => story.id)));
  const resumeSkippedStories = stories.filter((story) => shouldSkipStory(config, story)).length;
  const filteredOutStories = eligibleStories.length - storiesCoveredByClusters.size;
  const skippedStories = resumeSkippedStories + filteredOutStories;
  const executeCluster =
    options.executeCluster ?? (async ({ cluster }) => executeDefaultCluster(config, cluster));
  const evidence = (
    await Promise.all(clusters.map((cluster) => executeCluster({ cluster, stories: cluster.stories })))
  ).flat();
  const summary = createSummary(clusters, evidence, skippedStories);
  const artifacts = createAggregateArtifacts(options.reportsRoot);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const clusterByStoryId = new Map(
    clusters.flatMap((cluster) => cluster.stories.map((story) => [story.id, cluster.id] as const))
  );

  writeStagehandStoryCheckOverlay(artifacts.overlayPath, {
    generatedAt,
    sourcePath: options.storySourcePath,
    stories: evidence.map((entry) => ({
      clusterId: clusterByStoryId.get(entry.storyId) ?? 'unknown',
      storyId: entry.storyId,
      studioCheck: {
        status: entry.status,
        coverage: entry.coverage,
        notes: entry.notes,
      } satisfies StagehandStoryCheck,
      findings: entry.findings,
    })),
  });

  mkdirSync(dirname(artifacts.statusPath), { recursive: true });
  mkdirSync(dirname(artifacts.reportPath), { recursive: true });
  mkdirSync(dirname(artifacts.transcriptPath), { recursive: true });

  const aggregateStatus: StoryLoopAggregateStatus = {
    generatedAt,
    overlayPath: artifacts.overlayPath,
    stories: evidence.map((entry) => ({
      coverage: entry.coverage,
      findings: entry.findings,
      notes: entry.notes,
      status: entry.status,
      storyId: entry.storyId,
    })),
    summary,
    transcriptPath: artifacts.transcriptPath,
  };

  writeFileSync(artifacts.statusPath, `${JSON.stringify(aggregateStatus, null, 2)}\n`, 'utf8');
  writeFileSync(
    artifacts.reportPath,
    `${createAggregateMarkdown(generatedAt, summary, evidence, catalog.storyIndex, artifacts.transcriptPath)}\n`,
    'utf8'
  );
  writeFileSync(
    artifacts.transcriptPath,
    `${evidence
      .map((entry) =>
        JSON.stringify({
          storyId: entry.storyId,
          status: entry.status,
          coverage: entry.coverage,
          findings: entry.findings,
        })
      )
      .join('\n')}\n`,
    'utf8'
  );

  return {
    artifacts,
    summary,
  };
}
