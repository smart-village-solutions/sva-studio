import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { createMissionPrompt } from './missions/admin-users-overview.js';
import { getStagehandMission } from './missions/registry.js';
import { writeStagehandMissionArtifacts } from './reporting/files.js';
import type { StagehandMissionReport } from './reporting/report.js';
import { detectStagehandAuthIssue } from './runtime/auth.js';
import { parseStagehandAdminConfig } from './runtime/config.js';
import { assertStagehandReadiness, type StagehandFetch, type StagehandReadinessResult } from './runtime/readiness.js';

type StagehandCliEnv = Record<string, string | undefined>;

interface StagehandCliReadyPayload {
  status: 'READY';
  mission: string;
  baseUrl: string;
  adminUsername: string;
  missionStatus: 'passed' | 'failed' | 'blocked';
  reportPath: string;
  startUrl: string;
  statusPath: string;
  transcriptPath: string;
}

interface StagehandCliBlockedPayload {
  status: 'BLOCKED';
  message: string;
}

interface StagehandCliResult {
  exitCode: 0 | 1;
  stream: 'stdout' | 'stderr';
  payload: StagehandCliReadyPayload | StagehandCliBlockedPayload;
}

interface RunStagehandAdminCliOptions {
  readonly fetchImpl?: StagehandFetch;
  readonly generatedAt?: string;
  readonly reportsRoot?: string;
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

const DEFAULT_REPORTS_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/reports/stagehand-admin-exploration'
);
const HTML_REQUEST_INIT = {
  headers: {
    accept: 'text/html,application/xhtml+xml',
  },
  method: 'GET',
  redirect: 'manual',
} as const satisfies RequestInit;
const USERS_PAGE_MARKERS = ['Users table', 'Platform users table', 'User Management', 'Platform Users'] as const;
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

function createMissionReport(
  generatedAt: string,
  transcriptPath: string,
  status: StagehandMissionReport['status'],
  findings: readonly string[]
): StagehandMissionReport {
  return {
    generatedAt,
    mission: 'admin-users-overview',
    status,
    findings,
    screenshots: [],
    transcriptPath,
  };
}

async function executeAdminUsersOverviewMission(
  baseUrl: string,
  generatedAt: string,
  reportsRoot: string,
  fetchImpl: StagehandFetch
): Promise<StagehandMissionRunResult> {
  const mission = getStagehandMission('admin-users-overview');
  const artifacts = createArtifacts(reportsRoot, mission.name);
  const readiness = await assertStagehandReadiness(baseUrl, fetchImpl);
  const startUrl = createStartUrl(baseUrl, mission.startPath);
  const prompt = createMissionPrompt({ startUrl });

  createMissionPromptInvariant(prompt);

  const response = await fetchImpl(startUrl, HTML_REQUEST_INIT);
  const bodyText = await response.text();
  const findings = createBaseFindings(readiness, startUrl);
  const authIssue = detectStagehandAuthIssue({
    bodyText,
    requestedUrl: startUrl,
    response,
  });

  if (authIssue !== null) {
    findings.push(authIssue.message);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, authIssue.kind === 'login' ? 'blocked' : 'failed', findings),
      startUrl,
    };
  }

  const usersMarker = findFirstMarker(USERS_PAGE_MARKERS, bodyText);

  if (usersMarker !== null) {
    findings.push(`Benutzerverwaltung erkannt: ${usersMarker}.`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, 'passed', findings),
      startUrl,
    };
  }

  const emptyStateMarker = findFirstMarker(USERS_EMPTY_STATE_MARKERS, bodyText);

  if (emptyStateMarker !== null) {
    findings.push(`Gültiger Leerzustand erkannt: ${emptyStateMarker}`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, 'passed', findings),
      startUrl,
    };
  }

  const redirectLocation = response.headers.get('location');

  if (redirectLocation !== null) {
    findings.push(`Unerwarteter Redirect erkannt: ${redirectLocation}`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, 'failed', findings),
      startUrl,
    };
  }

  if (response.status >= 400) {
    findings.push(`Die Startseite antwortete ohne erkennbaren Nutzerkontext mit HTTP ${response.status}.`);

    return {
      artifacts,
      report: createMissionReport(generatedAt, artifacts.transcriptPath, 'failed', findings),
      startUrl,
    };
  }

  findings.push(
    'Die Benutzerverwaltung wurde geladen, aber weder Benutzerliste noch fachlich gültiger Leerzustand konnten eindeutig bestätigt werden.'
  );

  return {
    artifacts,
    report: createMissionReport(generatedAt, artifacts.transcriptPath, 'failed', findings),
    startUrl,
  };
}

async function runPilotMission(
  missionName: string,
  baseUrl: string,
  generatedAt: string,
  reportsRoot: string,
  fetchImpl: StagehandFetch
): Promise<StagehandMissionRunResult> {
  if (missionName !== 'admin-users-overview') {
    throw createUnsupportedMissionError(missionName);
  }

  return executeAdminUsersOverviewMission(baseUrl, generatedAt, reportsRoot, fetchImpl);
}

export async function runStagehandAdminCli(
  env: StagehandCliEnv,
  options: RunStagehandAdminCliOptions = {}
): Promise<StagehandCliResult> {
  try {
    const config = parseStagehandAdminConfig(env);
    const mission = getStagehandMission(config.mission);
    const missionRun = await runPilotMission(
      mission.name,
      config.baseUrl,
      options.generatedAt ?? new Date().toISOString(),
      options.reportsRoot ?? DEFAULT_REPORTS_ROOT,
      options.fetchImpl ?? fetch
    );

    writeStagehandMissionArtifacts(missionRun.artifacts, missionRun.report);

    return {
      exitCode: 0,
      stream: 'stdout',
      payload: {
        status: 'READY',
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
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isDirectExecution()) {
  process.exitCode = writeCliResult(await runStagehandAdminCli(process.env));
}
