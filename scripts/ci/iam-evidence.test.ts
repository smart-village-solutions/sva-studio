import { expect, it } from 'vitest';

import { parseAcceptanceConfig } from './iam-acceptance.ts';
import {
  buildEvidenceReport,
  createEvidenceArtifactPath,
  createEvidenceRunPaths,
  parseEvidenceConfig,
  renderEvidenceMarkdownReport,
  summarizeEvidenceCases,
} from './iam-evidence.ts';

const acceptance = parseAcceptanceConfig(
  {
    IAM_ACCEPTANCE_ADMIN_PASSWORD: 'fixture-admin-value',
    IAM_ACCEPTANCE_ADMIN_USERNAME: 'fixture-admin-user',
    IAM_ACCEPTANCE_MEMBER_PASSWORD: 'fixture-member-value',
    IAM_ACCEPTANCE_MEMBER_USERNAME: 'fixture-member-user',
    IAM_DATABASE_URL: 'postgres://localhost/sva',
    KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.com',
    KEYCLOAK_ADMIN_CLIENT_ID: 'fixture-client-id',
    KEYCLOAK_ADMIN_CLIENT_SECRET: 'fixture-client-value',
    KEYCLOAK_ADMIN_REALM: 'acceptance',
  },
  '/workspace'
);

it('parseEvidenceConfig applies defaults and optional overrides', () => {
  const config = parseEvidenceConfig(
    {
      IAM_EVIDENCE_NEGATIVE_PASSWORD: 'negative.secret',
      IAM_EVIDENCE_NEGATIVE_USERNAME: 'negative.user',
      IAM_EVIDENCE_PACKAGES: 'wp-003,wp-006',
      IAM_EVIDENCE_REPORT_SLUG: 'tenant-evidence',
      IAM_EVIDENCE_ROOT_USERNAME: 'demo.admin',
      IAM_EVIDENCE_ROOT_PASSWORD: 'demo.admin',
      IAM_EVIDENCE_INSTANCE_USERNAME: 'tenant.user',
      IAM_EVIDENCE_INSTANCE_PASSWORD: 'tenant.secret',
      IAM_EVIDENCE_WP005_USER_ID: 'user-7',
    },
    acceptance,
    '/workspace'
  );

  expect(config.packages).toEqual(['WP-003', 'WP-006']);
  expect(config.reportBasename).toBe('tenant-evidence');
  expect(config.rootActor.username).toBe('demo.admin');
  expect(config.instanceActor.username).toBe('tenant.user');
  expect(config.negativeActor?.username).toBe('negative.user');
  expect(config.screenshotRootDirectory).toBe('/workspace/docs/reports/artifacts/iam-evidence');
  expect(config.wp005.userId).toBe('user-7');
});

it('parseEvidenceConfig leaves negative actor unset when credentials are incomplete', () => {
  const config = parseEvidenceConfig(
    {
      IAM_EVIDENCE_NEGATIVE_USERNAME: 'negative.user',
    },
    acceptance,
    '/workspace'
  );

  expect(config.negativeActor).toBeNull();
});

it('evidence helpers summarize and render package sections', () => {
  const report = buildEvidenceReport({
    baseUrl: 'https://studio.example.com',
    generatedAt: '2026-05-25T08:00:00.000Z',
    instanceId: 'de-musterhausen',
    cases: [
      {
        packageId: 'WP-003',
        title: 'Organisationsübersicht der Zielumgebung',
        status: 'passed',
      },
      {
        packageId: 'WP-005',
        title: 'Transparenzfall aus Benutzerdetail',
        status: 'manual_review',
        artifacts: [{ description: 'Screenshot', kind: 'screenshot', path: 'artifacts/iam-evidence/run/wp-005.png' }],
      },
      {
        packageId: 'WP-006',
        title: 'Negativfall ohne Exportrecht',
        status: 'failed',
        details: 'HTTP 500 statt 403.',
      },
    ],
  });

  expect(summarizeEvidenceCases(report.cases)).toEqual({
    failed: 1,
    manualReview: 1,
    passed: 1,
    skipped: 0,
    status: 'failed',
  });

  const markdown = renderEvidenceMarkdownReport(report);
  expect(markdown).toMatch(/Verifikationsbericht: IAM Evidence/);
  expect(markdown).toMatch(/## WP-005/);
  expect(markdown).toMatch(/Status: manual_review/);
  expect(markdown).toMatch(/HTTP 500 statt 403/);
});

it('evidence run paths create deterministic report and artifact locations', () => {
  const runPaths = createEvidenceRunPaths(
    {
      reportBasename: 'iam-evidence',
      screenshotRootDirectory: '/workspace/docs/reports/artifacts/iam-evidence',
    },
    new Date('2026-05-25T08:00:00.000Z')
  );

  expect(runPaths.reportFileBase).toBe('iam-evidence-2026-05-25T08-00-00Z');
  expect(
    runPaths.artifactDirectory,
  ).toBe('/workspace/docs/reports/artifacts/iam-evidence/iam-evidence-2026-05-25T08-00-00Z');

  const artifactPath = createEvidenceArtifactPath({
    artifactDirectory: runPaths.artifactDirectory,
    filename: 'wp-006-export.json',
    reportDirectory: '/workspace/docs/reports',
  });
  expect(
    artifactPath.relativePath,
  ).toBe('artifacts/iam-evidence/iam-evidence-2026-05-25T08-00-00Z/wp-006-export.json');
});
