import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { createMissionPrompt } from './missions/admin-users-overview.js';
import { getAdminExplorationMission } from './missions/registry.js';
import { writeAdminExplorationMissionArtifacts } from './reporting/files.js';
import type { AdminExplorationMissionReport } from './reporting/report.js';
import { detectAdminExplorationAuthIssue } from './runtime/auth.js';
import { parseAdminExplorationConfig } from './runtime/config.js';
import { assertAdminExplorationReadiness, type AdminExplorationFetch, type AdminExplorationReadinessResult } from './runtime/readiness.js';
import type { Page } from '@playwright/test';

import { launchExplorationBrowser } from './runtime/browser.js';
import { runAdminExplorationStoryLoop, type RunAdminExplorationStoryLoopOptions, type AdminExplorationStoryLoopSummary } from './runtime/story-loop.js';
import type { AdminExplorationConfig } from './runtime/types.js';
import { getAdminExplorationMissionStories, type AdminExplorationStoryReference } from './stories/catalog.js';

type AdminExplorationCliEnv = Record<string, string | undefined>;

interface AdminExplorationCliMissionReadyPayload {
  status: 'READY';
  runMode: 'mission';
  mission: string;
  baseUrl: string;
  adminUsername: string;
  missionStatus: 'passed' | 'failed' | 'blocked';
  reportPath: string;
  startUrl: string;
  statusPath: string;
  transcriptPath: string;
}

interface AdminExplorationCliStoryLoopReadyPayload {
  status: 'READY';
  runMode: 'story-loop';
  baseUrl: string;
  adminUsername: string;
  reportPath: string;
  statusPath: string;
  summary: AdminExplorationStoryLoopSummary;
  transcriptPath: string;
}

interface AdminExplorationCliBlockedPayload {
  status: 'BLOCKED';
  message: string;
}

interface AdminExplorationCliResult {
  exitCode: 0 | 1;
  stream: 'stdout' | 'stderr';
  payload: AdminExplorationCliMissionReadyPayload | AdminExplorationCliStoryLoopReadyPayload | AdminExplorationCliBlockedPayload;
}

interface RunAdminExplorationCliOptions {
  readonly launchBrowser?: (config: AdminExplorationConfig) => Promise<ExplorationBrowserLike>;
  readonly executeCluster?: RunAdminExplorationStoryLoopOptions['executeCluster'];
  readonly fetchImpl?: AdminExplorationFetch;
  readonly generatedAt?: string;
  readonly reportsRoot?: string;
  readonly storySourcePath?: string;
}

interface AdminExplorationMissionArtifacts {
  readonly reportPath: string;
  readonly statusPath: string;
  readonly transcriptPath: string;
}

interface AdminExplorationMissionRunResult {
  readonly artifacts: AdminExplorationMissionArtifacts;
  readonly report: AdminExplorationMissionReport;
  readonly startUrl: string;
}

interface ExplorationBrowserLike {
  close(): Promise<void>;
  newPage(): Promise<Pick<Page, 'content' | 'goto'>>;
}

const DEFAULT_REPORTS_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/reports/admin-exploration'
);
const DEFAULT_STORY_SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json'
);
const HTML_REQUEST_INIT = {
  headers: {
    accept: 'text/html,application/xhtml+xml',
  },
  method: 'GET',
  redirect: 'manual',
} as const satisfies RequestInit;
const USERS_PAGE_MARKERS = [
  'Users table',
  'Platform users table',
  'User Management',
  'Platform Users',
  'Benutzertabelle',
  'Plattform-Benutzertabelle',
  'Benutzerverwaltung',
  'Plattform-Benutzer',
] as const;
const USERS_EMPTY_STATE_MARKERS = ['Keine Nutzer gefunden.', 'No users found.'] as const;

function createArtifacts(reportsRoot: string, missionName: string): AdminExplorationMissionArtifacts {
  const missionDirectory = join(reportsRoot, missionName);

  return {
    reportPath: join(missionDirectory, 'report.md'),
    statusPath: join(missionDirectory, 'status.json'),
    transcriptPath: join(missionDirectory, 'transcript.jsonl'),
  };
}

function createStartUrl(baseUrl: string, startPath: string): string {
  return new URL(startPath, `${baseUrl}/`).toString();
}

function createUnsupportedMissionError(missionName: string): Error {
  return new Error(`AdminExploration admin mission is not implemented in the pilot runner: ${missionName}`);
}

function findFirstMarker(markers: readonly string[], bodyText: string): string | null {
  return markers.find((marker) => bodyText.includes(marker)) ?? null;
}

function createMissionPromptInvariant(prompt: string): void {
  if (
    prompt.includes('/admin/users') === false ||
    prompt.includes('Login') === false ||
    prompt.includes('Forbidden') === false
  ) {
    throw new Error('AdminExploration admin-users-overview prompt invariant failed.');
  }
}

function createBaseFindings(readiness: AdminExplorationReadinessResult, startUrl: string): string[] {
  return [
    `Lokale Readiness erfolgreich: ${readiness.checkedUrl} (HTTP ${readiness.httpStatus}).`,
    `Start-URL geöffnet: ${startUrl}`,
  ];
}

function createStoryBasisFinding(stories: readonly AdminExplorationStoryReference[]): string {
  return `Story-Basis geladen: ${stories.map((story) => `${story.packageId}#${story.id}`).join(', ')}.`;
}

function createMissionReport(
  generatedAt: string,
  transcriptPath: string,
  stories: readonly AdminExplorationStoryReference[],
  status: AdminExplorationMissionReport['status'],
  findings: readonly string[]
): AdminExplorationMissionReport {
  return {
    generatedAt,
    mission: 'admin-users-overview',
    status,
    stories,
    findings,
    screenshots: [],
    transcriptPath,
  };
}

async function executeAdminUsersOverviewMission(
  config: AdminExplorationConfig,
  generatedAt: string,
  reportsRoot: string,
  fetchImpl: AdminExplorationFetch,
  launchBrowser: (config: AdminExplorationConfig) => Promise<ExplorationBrowserLike>
): Promise<AdminExplorationMissionRunResult> {
  const mission = getAdminExplorationMission('admin-users-overview');
  const stories = getAdminExplorationMissionStories(mission.name);
  const artifacts = createArtifacts(reportsRoot, mission.name);
  const readiness = await assertAdminExplorationReadiness(config.baseUrl, fetchImpl);
  const startUrl = createStartUrl(config.baseUrl, mission.startPath);
  const prompt = createMissionPrompt({ startUrl, stories });

  createMissionPromptInvariant(prompt);

  const response = await fetchImpl(startUrl, HTML_REQUEST_INIT);
  const browser = await launchBrowser(config);
  const bodyText = await (async () => {
    try {
      const page = await browser.newPage();

      await page.goto(startUrl);
      return await page.content();
    } finally {
      await browser.close();
    }
  })();

  const findings = createBaseFindings(readiness, startUrl);
  findings.push(createStoryBasisFinding(stories));
  const authIssue = detectAdminExplorationAuthIssue({
    bodyText,
    requestedUrl: startUrl,
    response,
  });

  if (authIssue !== null) {
    findings.push(authIssue.message);

    return {
      artifacts,
      report: createMissionReport(
        generatedAt,
        artifacts.transcriptPath,
        stories,
        authIssue.kind === 'login' ? 'blocked' : 'failed',
        findings
      ),
      startUrl,
    };
  }

  const usersMarker = findFirstMarker(USERS_PAGE_MARKERS, bodyText);

  if (usersMarker !== null) {
    findings.push(`Benutzerverwaltung erkannt: ${usersMarker}.`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, stories, 'passed', findings),
      startUrl,
    };
  }

  const emptyStateMarker = findFirstMarker(USERS_EMPTY_STATE_MARKERS, bodyText);

  if (emptyStateMarker !== null) {
    findings.push(`Gültiger Leerzustand erkannt: ${emptyStateMarker}`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, stories, 'passed', findings),
      startUrl,
    };
  }

  const redirectLocation = response.headers.get('location');

  if (redirectLocation !== null) {
    findings.push(`Unerwarteter Redirect erkannt: ${redirectLocation}`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, stories, 'failed', findings),
      startUrl,
    };
  }

  if (response.status >= 400) {
    findings.push(`Die Startseite antwortete ohne erkennbaren Nutzerkontext mit HTTP ${response.status}.`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, stories, 'failed', findings),
      startUrl,
    };
  }

  findings.push(
    'Die Benutzerverwaltung wurde geladen, aber weder Benutzerliste noch fachlich gültiger Leerzustand konnten eindeutig bestätigt werden.'
  );

  return {
    artifacts,
    report: createMissionReport(generatedAt, artifacts.transcriptPath, stories, 'failed', findings),
    startUrl,
  };
}

async function runPilotMission(
  missionName: string,
  config: AdminExplorationConfig,
  generatedAt: string,
  reportsRoot: string,
  fetchImpl: AdminExplorationFetch,
  launchBrowser: (config: AdminExplorationConfig) => Promise<ExplorationBrowserLike>
): Promise<AdminExplorationMissionRunResult> {
  if (missionName !== 'admin-users-overview') {
    throw createUnsupportedMissionError(missionName);
  }

  return executeAdminUsersOverviewMission(config, generatedAt, reportsRoot, fetchImpl, launchBrowser);
}

export async function runAdminExplorationCli(
  env: AdminExplorationCliEnv,
  options: RunAdminExplorationCliOptions = {}
): Promise<AdminExplorationCliResult> {
  try {
    const config = parseAdminExplorationConfig(env);
    const launchBrowser = options.launchBrowser ?? launchExplorationBrowser;
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const reportsRoot = options.reportsRoot ?? DEFAULT_REPORTS_ROOT;

    if (config.runMode === 'story-loop') {
      await assertAdminExplorationReadiness(config.baseUrl, options.fetchImpl ?? fetch);
      const loopRun = await runAdminExplorationStoryLoop(config, {
        executeCluster: options.executeCluster,
        generatedAt,
        reportsRoot,
        storySourcePath: options.storySourcePath ?? DEFAULT_STORY_SOURCE_PATH,
      });

      return {
        exitCode: 0,
        stream: 'stdout',
        payload: {
          status: 'READY',
          runMode: 'story-loop',
          baseUrl: config.baseUrl,
          adminUsername: config.admin.username,
          reportPath: loopRun.artifacts.reportPath,
          statusPath: loopRun.artifacts.statusPath,
          summary: loopRun.summary,
          transcriptPath: loopRun.artifacts.transcriptPath,
        },
      };
    }

    const mission = getAdminExplorationMission(config.mission);
    const missionRun = await runPilotMission(
      mission.name,
      config,
      generatedAt,
      reportsRoot,
      options.fetchImpl ?? fetch,
      launchBrowser
    );

    writeAdminExplorationMissionArtifacts(missionRun.artifacts, missionRun.report);

    return {
      exitCode: 0,
      stream: 'stdout',
      payload: {
        status: 'READY',
        runMode: 'mission',
        mission: config.mission,
        baseUrl: config.baseUrl,
        adminUsername: config.admin.username,
        missionStatus: missionRun.report.status,
        reportPath: missionRun.artifacts.reportPath,
        startUrl: missionRun.startUrl,
        statusPath: missionRun.artifacts.statusPath,
        transcriptPath: missionRun.artifacts.transcriptPath,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AdminExploration admin bootstrap error';

    return {
      exitCode: 1,
      stream: 'stderr',
      payload: {
        status: 'BLOCKED',
        message,
      },
    };
  }
}

function writeCliResult(result: AdminExplorationCliResult): number {
  const serializedResult = JSON.stringify(result.payload);

  if (result.stream === 'stdout') {
    console.info(serializedResult);
  } else {
    console.error(serializedResult);
  }

  return result.exitCode;
}

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isDirectExecution()) {
  process.exitCode = writeCliResult(await runAdminExplorationCli(process.env));
}
