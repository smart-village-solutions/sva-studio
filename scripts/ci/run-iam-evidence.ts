import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAcceptanceConfig } from './iam-acceptance.ts';
import {
  buildEvidenceReport,
  createEvidenceRunPaths,
  parseEvidenceConfig,
  writeEvidenceReports,
  type EvidenceCaseRecord,
  type EvidenceConfig,
  type EvidencePackageId,
  type EvidenceRunPaths,
} from './iam-evidence.ts';
import type { RecordCase } from './iam-evidence-artifacts.js';
import type { Browser, Pool } from './iam-evidence-session.js';
import { runWp003Evidence } from './iam-evidence-wp003.js';
import { runWp005Evidence } from './iam-evidence-wp005.js';
import { runWp006Evidence } from './iam-evidence-wp006.js';

type BrowserModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<Browser>;
  };
};
type PgModule = {
  Pool: new (options: { connectionString: string }) => Pool;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../..');
const appRequire = createRequire(resolve(rootDir, 'apps/sva-studio-react/package.json'));
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));

const { chromium } = appRequire('@playwright/test') as BrowserModule;
const { Pool } = authRuntimeRequire('pg') as PgModule;

const reportCases: EvidenceCaseRecord[] = [];

const recordCase = (entry: EvidenceCaseRecord): EvidenceCaseRecord => {
  reportCases.push(entry);
  console.log(`[iam-evidence] ${entry.status.toUpperCase()} ${entry.packageId} ${entry.title}`);
  return entry;
};

const runEvidencePackage = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  packageId: EvidencePackageId;
  recordCase: RecordCase;
  pool: Pool;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<void> => {
  switch (input.packageId) {
    case 'WP-003':
      await runWp003Evidence(input);
      break;
    case 'WP-005':
      await runWp005Evidence(input);
      break;
    case 'WP-006':
      await runWp006Evidence(input);
      break;
  }
};

const main = async (): Promise<void> => {
  const startedAt = new Date();
  let reportFileBase = 'iam-evidence';

  try {
    const acceptance = parseAcceptanceConfig(process.env, rootDir);
    const config = parseEvidenceConfig(process.env, acceptance, rootDir);
    const runPaths = createEvidenceRunPaths(config, startedAt);
    reportFileBase = runPaths.reportFileBase;

    const browser = await chromium.launch({ headless: true });
    const pool = new Pool({ connectionString: config.acceptance.databaseUrl });

    try {
      for (const packageId of config.packages) {
        await runEvidencePackage({
          browser,
          config,
          packageId,
          recordCase,
          pool,
          reportDirectory: config.reportDirectory,
          runPaths,
        });
      }
    } finally {
      await browser.close().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }

    const report = buildEvidenceReport({
      baseUrl: config.acceptance.baseUrl,
      cases: reportCases,
      generatedAt: startedAt.toISOString(),
      instanceId: config.acceptance.instanceId,
    });
    const reportPaths = await writeEvidenceReports({
      report,
      reportDirectory: config.reportDirectory,
      reportFileBase,
    });

    console.log(`[iam-evidence] report written: ${reportPaths.markdownPath}`);
    console.log(`[iam-evidence] json written: ${reportPaths.jsonPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = buildEvidenceReport({
      baseUrl: process.env.IAM_ACCEPTANCE_BASE_URL?.trim() || 'http://127.0.0.1:3000',
      cases: [
        ...reportCases,
        {
          packageId: 'WP-003',
          title: 'Runner-Ausführung',
          status: 'failed',
          details: message,
        },
      ],
      generatedAt: startedAt.toISOString(),
      instanceId: process.env.IAM_ACCEPTANCE_INSTANCE_ID?.trim() || 'de-musterhausen',
    });
    const reportDirectory = resolve(
      rootDir,
      process.env.IAM_EVIDENCE_REPORT_DIR?.trim() || 'docs/reports'
    );
    await writeEvidenceReports({
      report,
      reportDirectory,
      reportFileBase,
    }).catch(() => undefined);
    console.error(`[iam-evidence] failed: ${message}`);
    process.exitCode = 1;
  }
};

void main();
