import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAcceptanceReport,
  parseAcceptanceConfig,
  renderAcceptanceMarkdownReport,
  summarizeAcceptanceSteps,
} from './iam-acceptance.ts';

test('parseAcceptanceConfig applies defaults and reads required env', () => {
  const config = parseAcceptanceConfig(
    {
      IAM_ACCEPTANCE_ADMIN_PASSWORD: 'secret-admin',
      IAM_ACCEPTANCE_ADMIN_USERNAME: 'acceptance-admin',
      IAM_ACCEPTANCE_MEMBER_PASSWORD: 'secret-member',
      IAM_ACCEPTANCE_MEMBER_USERNAME: 'acceptance-member',
      IAM_DATABASE_URL: 'postgres://localhost/sva',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.com',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'svc-secret',
      KEYCLOAK_ADMIN_REALM: 'acceptance',
    },
    '/workspace'
  );

  assert.equal(config.baseUrl, 'http://127.0.0.1:3000');
  assert.equal(config.instanceId, 'de-musterhausen');
  assert.deepEqual(config.admin.expectedRoles, ['system_admin']);
  assert.equal(config.reportDirectory, '/workspace/docs/reports');
});

test('parseAcceptanceConfig rejects incomplete configuration', () => {
  assert.throws(
    () =>
      parseAcceptanceConfig({
        IAM_ACCEPTANCE_ADMIN_USERNAME: 'acceptance-admin',
      }),
    /Missing required acceptance env/
  );
});

test('report helpers summarize and render acceptance steps', () => {
  const report = buildAcceptanceReport({
    baseUrl: 'https://studio.example.com',
    generatedAt: '2026-03-17T09:00:00.000Z',
    instanceId: 'de-musterhausen',
    steps: [
      { name: 'Readiness', status: 'passed', details: 'Alle Dependencies gesund.' },
      { name: 'OIDC Login', status: 'failed', failureCode: 'acceptance_login_failed', details: 'Login schlug fehl.' },
      { name: 'UI Nachweis', status: 'skipped', details: 'Vorheriger Schritt fehlgeschlagen.' },
    ],
  });

  assert.deepEqual(summarizeAcceptanceSteps(report.steps), {
    failed: 1,
    passed: 1,
    skipped: 1,
    status: 'failed',
  });

  const markdown = renderAcceptanceMarkdownReport(report);
  assert.match(markdown, /Verifikationsbericht: IAM Foundation Acceptance/);
  assert.match(markdown, /Fehlercode: acceptance_login_failed/);
  assert.match(markdown, /Ergebnis: fehlgeschlagen/);
});
