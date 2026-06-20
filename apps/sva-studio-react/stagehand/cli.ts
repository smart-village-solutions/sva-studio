import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { createMissionPrompt } from './missions/admin-users-overview.js';
import { getStagehandMission } from './missions/registry.js';
import { writeStagehandMissionArtifacts } from './reporting/files.js';
import type { StagehandMissionReport } from './reporting/report.js';
import { detectStagehandAuthIssue } from './runtime/auth.js';
import { parseStagehandAdminConfig } from './runtime/config.js';
import { assertStagehandReadiness, type StagehandFetch, type StagehandReadinessResult } from './runtime/readiness.js';
import { createLocalStagehand } from './runtime/sdk.js';
import { runStagehandStoryLoop, type RunStagehandStoryLoopOptions, type StagehandStoryLoopSummary } from './runtime/story-loop.js';
import type { StagehandAdminConfig } from './runtime/types.js';
import { getStagehandMissionStories, type StagehandStoryReference } from './stories/catalog.js';

type StagehandCliEnv = Record<string, string | undefined>;

interface StagehandCliMissionReadyPayload {
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

interface StagehandCliStoryLoopReadyPayload {
  status: 'READY';
  runMode: 'story-loop';
  baseUrl: string;
  adminUsername: string;
  reportPath: string;
  statusPath: string;
  summary: StagehandStoryLoopSummary;
  transcriptPath: string;
}

interface StagehandCliBlockedPayload {
  status: 'BLOCKED';
  message: string;
}

interface StagehandCliResult {
  exitCode: 0 | 1;
  stream: 'stdout' | 'stderr';
  payload: StagehandCliMissionReadyPayload | StagehandCliStoryLoopReadyPayload | StagehandCliBlockedPayload;
}

interface RunStagehandAdminCliOptions {
  readonly createStagehand?: (config: StagehandAdminConfig) => StagehandSessionLike;
  readonly executeCluster?: RunStagehandStoryLoopOptions['executeCluster'];
  readonly fetchImpl?: StagehandFetch;
  readonly generatedAt?: string;
  readonly reportsRoot?: string;
  readonly storySourcePath?: string;
}

interface StagehandMissionArtifacts {
  readonly reportPath: string;
  readonly statusPath: string;
  readonly transcriptPath: string;
}

interface StagehandMissionRunResult {
  readonly artifacts: StagehandMissionArtifacts;
  readonly report: StagehandMissionReport;
  readonly startUrl: string;
}

interface StagehandPageLike {
  evaluate(pageFunctionOrExpression: string | ((arg: unknown) => unknown | Promise<unknown>), arg?: unknown): Promise<unknown>;
  goto(url: string): Promise<unknown>;
  url(): string;
}

interface StagehandSessionLike {
  close(): Promise<void>;
  context: {
    pages(): StagehandPageLike[];
  };
  init(): Promise<void>;
}

const DEFAULT_REPORTS_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/reports/stagehand-admin-exploration'
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

function createArtifacts(reportsRoot: string, missionName: string): StagehandMissionArtifacts {
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
  return new Error(`Stagehand admin mission is not implemented in the pilot runner: ${missionName}`);
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
    throw new Error('Stagehand admin-users-overview prompt invariant failed.');
  }
}

function createBaseFindings(readiness: StagehandReadinessResult, startUrl: string): string[] {
  return [
    `Lokale Readiness erfolgreich: ${readiness.checkedUrl} (HTTP ${readiness.httpStatus}).`,
    `Start-URL geöffnet: ${startUrl}`,
  ];
}

function createStoryBasisFinding(stories: readonly StagehandStoryReference[]): string {
  return `Story-Basis geladen: ${stories.map((story) => `${story.packageId}#${story.id}`).join(', ')}.`;
}

function createMissionReport(
  generatedAt: string,
  transcriptPath: string,
  stories: readonly StagehandStoryReference[],
  status: StagehandMissionReport['status'],
  findings: readonly string[]
): StagehandMissionReport {
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
  config: StagehandAdminConfig,
  generatedAt: string,
  reportsRoot: string,
  fetchImpl: StagehandFetch,
  createStagehandSession: (config: StagehandAdminConfig) => StagehandSessionLike
): Promise<StagehandMissionRunResult> {
  const mission = getStagehandMission('admin-users-overview');
  const stories = getStagehandMissionStories(mission.name);
  const artifacts = createArtifacts(reportsRoot, mission.name);
  const readiness = await assertStagehandReadiness(config.baseUrl, fetchImpl);
  const startUrl = createStartUrl(config.baseUrl, mission.startPath);
  const prompt = createMissionPrompt({ startUrl, stories });

  createMissionPromptInvariant(prompt);

  const response = await fetchImpl(startUrl, HTML_REQUEST_INIT);
  const stagehand = createStagehandSession(config);
  let bodyText = '';

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    if (page === undefined) {
      throw new Error('Stagehand did not expose an initial browser page for the admin mission.');
    }

    await page.goto(startUrl);
    const evaluatedHtml = await page.evaluate(() => document.documentElement.outerHTML);
    bodyText = typeof evaluatedHtml === 'string' ? evaluatedHtml : String(evaluatedHtml);
  } finally {
    await stagehand.close();
  }

  const findings = createBaseFindings(readiness, startUrl);
  findings.push(createStoryBasisFinding(stories));
  const authIssue = detectStagehandAuthIssue({
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
  config: StagehandAdminConfig,
  generatedAt: string,
  reportsRoot: string,
  fetchImpl: StagehandFetch,
  createStagehandSession: (config: StagehandAdminConfig) => StagehandSessionLike
): Promise<StagehandMissionRunResult> {
  if (missionName !== 'admin-users-overview') {
    throw createUnsupportedMissionError(missionName);
  }

  return executeAdminUsersOverviewMission(config, generatedAt, reportsRoot, fetchImpl, createStagehandSession);
}

export async function runStagehandAdminCli(
  env: StagehandCliEnv,
  options: RunStagehandAdminCliOptions = {}
): Promise<StagehandCliResult> {
  try {
    const config = parseStagehandAdminConfig(env);
    const createStagehandSession = options.createStagehand ?? createLocalStagehand;
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const reportsRoot = options.reportsRoot ?? DEFAULT_REPORTS_ROOT;

    if (config.runMode === 'story-loop') {
      await assertStagehandReadiness(config.baseUrl, options.fetchImpl ?? fetch);
      const loopRun = await runStagehandStoryLoop(config, {
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

    const mission = getStagehandMission(config.mission);
    const missionRun = await runPilotMission(
      mission.name,
      config,
      generatedAt,
      reportsRoot,
      options.fetchImpl ?? fetch,
      createStagehandSession
    );

    writeStagehandMissionArtifacts(missionRun.artifacts, missionRun.report);

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
    const message = error instanceof Error ? error.message : 'Unknown Stagehand admin bootstrap error';

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

function writeCliResult(result: StagehandCliResult): number {
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
  process.exitCode = writeCliResult(await runStagehandAdminCli(process.env));
}
