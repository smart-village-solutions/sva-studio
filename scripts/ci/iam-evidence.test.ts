import assert from 'node:assert/strict';
import test from 'node:test';

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

test('parseEvidenceConfig applies defaults and optional overrides', () => {
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

  assert.deepEqual(config.packages, ['WP-003', 'WP-006']);
  assert.equal(config.reportBasename, 'tenant-evidence');
  assert.equal(config.rootActor.username, 'demo.admin');
  assert.equal(config.instanceActor.username, 'tenant.user');
  assert.equal(config.negativeActor?.username, 'negative.user');
  assert.equal(config.screenshotRootDirectory, '/workspace/docs/reports/artifacts/iam-evidence');
  assert.equal(config.wp005.userId, 'user-7');
});

test('parseEvidenceConfig leaves negative actor unset when credentials are incomplete', () => {
  const config = parseEvidenceConfig(
    {
      IAM_EVIDENCE_NEGATIVE_USERNAME: 'negative.user',
    },
    acceptance,
    '/workspace'
  );

  assert.equal(config.negativeActor, null);
});

test('evidence helpers summarize and render package sections', () => {
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

  assert.deepEqual(summarizeEvidenceCases(report.cases), {
    failed: 1,
    manualReview: 1,
    passed: 1,
    skipped: 0,
    status: 'failed',
  });

  const markdown = renderEvidenceMarkdownReport(report);
  assert.match(markdown, /Verifikationsbericht: IAM Evidence/);
  assert.match(markdown, /## WP-005/);
  assert.match(markdown, /Status: manual_review/);
  assert.match(markdown, /HTTP 500 statt 403/);
});

test('evidence run paths create deterministic report and artifact locations', () => {
  const runPaths = createEvidenceRunPaths(
    {
      reportBasename: 'iam-evidence',
      screenshotRootDirectory: '/workspace/docs/reports/artifacts/iam-evidence',
    },
    new Date('2026-05-25T08:00:00.000Z')
  );

  assert.equal(runPaths.reportFileBase, 'iam-evidence-2026-05-25T08-00-00Z');
  assert.equal(
    runPaths.artifactDirectory,
    '/workspace/docs/reports/artifacts/iam-evidence/iam-evidence-2026-05-25T08-00-00Z'
  );

  const artifactPath = createEvidenceArtifactPath({
    artifactDirectory: runPaths.artifactDirectory,
    filename: 'wp-006-export.json',
    reportDirectory: '/workspace/docs/reports',
  });
  assert.equal(
    artifactPath.relativePath,
    'artifacts/iam-evidence/iam-evidence-2026-05-25T08-00-00Z/wp-006-export.json'
  );
});
