import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import type { AcceptanceConfig } from './iam-acceptance.ts';

export type EvidencePackageId = 'WP-003' | 'WP-005' | 'WP-006';

export type EvidenceActorConfig = {
  readonly password: string;
  readonly username: string;
};

export type EvidenceCaseStatus = 'failed' | 'manual_review' | 'passed' | 'skipped';

export type EvidenceArtifact = {
  readonly description: string;
  readonly kind: 'export' | 'json' | 'screenshot';
  readonly path: string;
};

export type EvidenceCaseRecord = {
  readonly artifacts?: readonly EvidenceArtifact[];
  readonly details?: string;
  readonly packageId: EvidencePackageId;
  readonly status: EvidenceCaseStatus;
  readonly title: string;
};

export type EvidenceReport = {
  readonly cases: readonly EvidenceCaseRecord[];
  readonly generatedAt: string;
  readonly summary: {
    readonly failed: number;
    readonly manualReview: number;
    readonly passed: number;
    readonly skipped: number;
    readonly status: 'failed' | 'manual_review' | 'passed';
  };
  readonly target: {
    readonly baseUrl: string;
    readonly instanceId: string;
  };
};

export type EvidenceConfig = {
  readonly acceptance: AcceptanceConfig;
  readonly instanceActor: EvidenceActorConfig;
  readonly negativeActor: EvidenceActorConfig | null;
  readonly packages: readonly EvidencePackageId[];
  readonly reportBasename: string;
  readonly reportDirectory: string;
  readonly rootActor: EvidenceActorConfig;
  readonly screenshotRootDirectory: string;
  readonly wp005: {
    readonly userId: string | null;
  };
};

export type EvidenceRunPaths = {
  readonly artifactDirectory: string;
  readonly reportFileBase: string;
};

const evidencePackages = ['WP-003', 'WP-005', 'WP-006'] as const satisfies readonly EvidencePackageId[];

const readOptionalEnv = (env: NodeJS.ProcessEnv, key: string): string | null => {
  const value = env[key]?.trim();
  return value ? value : null;
};

const parseEvidencePackages = (value: string | null): readonly EvidencePackageId[] => {
  if (!value) {
    return evidencePackages;
  }

  const selected = value
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);

  if (selected.length === 0) {
    return evidencePackages;
  }

  const invalidEntries = selected.filter(
    (entry): entry is string => !(evidencePackages as readonly string[]).includes(entry)
  );
  if (invalidEntries.length > 0) {
    throw new Error(`Unsupported IAM evidence package ids: ${invalidEntries.join(', ')}`);
  }

  return selected as readonly EvidencePackageId[];
};

export const parseEvidenceConfig = (
  env: NodeJS.ProcessEnv,
  acceptance: AcceptanceConfig,
  rootDir = process.cwd()
): EvidenceConfig => {
  const reportDirectory = resolve(rootDir, readOptionalEnv(env, 'IAM_EVIDENCE_REPORT_DIR') ?? acceptance.reportDirectory);
  const screenshotRootDirectory = resolve(
    reportDirectory,
    readOptionalEnv(env, 'IAM_EVIDENCE_ARTIFACT_DIR') ?? 'artifacts/iam-evidence'
  );

  const negativeUsername = readOptionalEnv(env, 'IAM_EVIDENCE_NEGATIVE_USERNAME');
  const negativePassword = readOptionalEnv(env, 'IAM_EVIDENCE_NEGATIVE_PASSWORD');

  return {
    acceptance,
    instanceActor: {
      username: readOptionalEnv(env, 'IAM_EVIDENCE_INSTANCE_USERNAME') ?? acceptance.member.username,
      password: readOptionalEnv(env, 'IAM_EVIDENCE_INSTANCE_PASSWORD') ?? acceptance.member.password,
    },
    negativeActor:
      negativeUsername && negativePassword
        ? {
            username: negativeUsername,
            password: negativePassword,
          }
        : null,
    packages: parseEvidencePackages(readOptionalEnv(env, 'IAM_EVIDENCE_PACKAGES')),
    reportBasename: readOptionalEnv(env, 'IAM_EVIDENCE_REPORT_SLUG') ?? 'iam-evidence',
    reportDirectory,
    rootActor: {
      username: readOptionalEnv(env, 'IAM_EVIDENCE_ROOT_USERNAME') ?? acceptance.admin.username,
      password: readOptionalEnv(env, 'IAM_EVIDENCE_ROOT_PASSWORD') ?? acceptance.admin.password,
    },
    screenshotRootDirectory,
    wp005: {
      userId: readOptionalEnv(env, 'IAM_EVIDENCE_WP005_USER_ID'),
    },
  };
};

export const summarizeEvidenceCases = (
  cases: readonly EvidenceCaseRecord[]
): EvidenceReport['summary'] => {
  const passed = cases.filter((entry) => entry.status === 'passed').length;
  const failed = cases.filter((entry) => entry.status === 'failed').length;
  const skipped = cases.filter((entry) => entry.status === 'skipped').length;
  const manualReview = cases.filter((entry) => entry.status === 'manual_review').length;

  return {
    failed,
    manualReview,
    passed,
    skipped,
    status: failed > 0 ? 'failed' : manualReview > 0 ? 'manual_review' : 'passed',
  };
};

export const buildEvidenceReport = (input: {
  baseUrl: string;
  cases: readonly EvidenceCaseRecord[];
  generatedAt?: string;
  instanceId: string;
}): EvidenceReport => ({
  cases: input.cases,
  generatedAt: input.generatedAt ?? new Date().toISOString(),
  summary: summarizeEvidenceCases(input.cases),
  target: {
    baseUrl: input.baseUrl,
    instanceId: input.instanceId,
  },
});

const renderArtifactLink = (artifact: EvidenceArtifact): string =>
  `- ${artifact.description}: [${artifact.path}](./${artifact.path.replace(/\\/g, '/')})`;

export const renderEvidenceMarkdownReport = (report: EvidenceReport): string => {
  const lines = [
    '# Verifikationsbericht: IAM Evidence',
    '',
    '## Kontext',
    '',
    `- Zeitpunkt: ${report.generatedAt}`,
    `- Zielumgebung: ${report.target.baseUrl}`,
    `- Instanzkontext: ${report.target.instanceId}`,
    `- Gesamtstatus: ${report.summary.status}`,
    '',
    '## Zusammenfassung',
    '',
    `- Erfolgreiche Nachweise: ${report.summary.passed}`,
    `- Fehlgeschlagene Nachweise: ${report.summary.failed}`,
    `- Manuelle Review-Nachweise: ${report.summary.manualReview}`,
    `- Übersprungene Nachweise: ${report.summary.skipped}`,
    '',
  ];

  for (const packageId of evidencePackages) {
    const packageCases = report.cases.filter((entry) => entry.packageId === packageId);
    if (packageCases.length === 0) {
      continue;
    }

    lines.push(`## ${packageId}`);
    lines.push('');

    for (const entry of packageCases) {
      lines.push(`### ${entry.title}`);
      lines.push('');
      lines.push(`- Status: ${entry.status}`);
      if (entry.details) {
        lines.push(`- Details: ${entry.details}`);
      }
      if (entry.artifacts && entry.artifacts.length > 0) {
        lines.push('- Artefakte:');
        for (const artifact of entry.artifacts) {
          lines.push(renderArtifactLink(artifact));
        }
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
};

export const createEvidenceRunPaths = (
  config: Pick<EvidenceConfig, 'reportBasename' | 'screenshotRootDirectory'>,
  generatedAt: Date
): EvidenceRunPaths => {
  const isoDate = generatedAt.toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
  const reportFileBase = `${config.reportBasename}-${isoDate}`;

  return {
    artifactDirectory: resolve(config.screenshotRootDirectory, reportFileBase),
    reportFileBase,
  };
};

export const createEvidenceArtifactPath = (input: {
  artifactDirectory: string;
  filename: string;
  reportDirectory: string;
}): { absolutePath: string; relativePath: string } => {
  const absolutePath = resolve(input.artifactDirectory, input.filename);
  const relativePath = relative(input.reportDirectory, absolutePath);
  return {
    absolutePath,
    relativePath,
  };
};

export const writeEvidenceReports = async (input: {
  report: EvidenceReport;
  reportDirectory: string;
  reportFileBase: string;
}): Promise<{ jsonPath: string; markdownPath: string }> => {
  const markdownPath = resolve(input.reportDirectory, `${input.reportFileBase}.md`);
  const jsonPath = resolve(input.reportDirectory, `${input.reportFileBase}.json`);
  await mkdir(input.reportDirectory, { recursive: true });
  await writeFile(markdownPath, renderEvidenceMarkdownReport(input.report), 'utf8');
  await writeFile(jsonPath, `${JSON.stringify(input.report, null, 2)}\n`, 'utf8');
  return { jsonPath, markdownPath };
};
