import type { EvidenceConfig, EvidenceRunPaths } from './iam-evidence.ts';
import { captureScreenshot, writeTextArtifact } from './iam-evidence-artifacts.js';
import type { RecordCase } from './iam-evidence-artifacts.js';
import {
  hasVisibleText,
  loginAndReadSession,
  READINESS_TIMEOUT_MS,
} from './iam-evidence-session.js';
import type { ApiResponse, Browser } from './iam-evidence-session.js';

const fetchText = async (response: ApiResponse): Promise<string> => response.text();

type Wp006Input = {
  browser: Browser;
  config: EvidenceConfig;
  recordCase: RecordCase;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
};

const runPositiveExport = async (input: Wp006Input): Promise<void> => {
  const { recordCase } = input;
  const adminSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Root-Admin',
    password: input.config.rootActor.password,
    username: input.config.rootActor.username,
  });

  try {
    const exportUrl = new URL(
      '/iam/governance/legal-consents/export',
      input.config.acceptance.baseUrl
    );
    exportUrl.searchParams.set('instanceId', input.config.acceptance.instanceId);
    exportUrl.searchParams.set('format', 'json');

    const positiveResponse = await adminSession.context.request.get(exportUrl.toString(), {
      failOnStatusCode: false,
    });
    const positiveBody = await fetchText(positiveResponse);
    const positiveArtifact = await writeTextArtifact({
      contents: positiveBody,
      description: 'WP-006 positiver Consent-Export',
      filename: 'wp-006-consent-export-positive.json',
      kind: 'export',
      reportDirectory: input.reportDirectory,
      runPaths: input.runPaths,
    });

    recordCase({
      packageId: 'WP-006',
      title: 'Erfolgreicher Export mit Berechtigung',
      status: positiveResponse.status() === 200 ? 'passed' : 'failed',
      details:
        positiveResponse.status() === 200
          ? 'Consent-Export antwortete mit HTTP 200 und wurde als Artefakt archiviert.'
          : `Consent-Export antwortete unerwartet mit HTTP ${positiveResponse.status()}.`,
      artifacts: [
        positiveArtifact,
        await writeTextArtifact({
          contents: `${JSON.stringify({ status: positiveResponse.status(), headers: positiveResponse.headers() }, null, 2)}\n`,
          description: 'WP-006 Metadaten des positiven Exports',
          filename: 'wp-006-consent-export-positive.meta.json',
          kind: 'json',
          reportDirectory: input.reportDirectory,
          runPaths: input.runPaths,
        }),
      ],
    });
  } finally {
    await adminSession.page.close().catch(() => undefined);
    await adminSession.context.close().catch(() => undefined);
  }
};

const runNegativeExport = async (
  input: Wp006Input,
  negativeActor: NonNullable<EvidenceConfig['negativeActor']>
): Promise<void> => {
  const { recordCase } = input;
  const negativeSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Negativfall-Benutzer',
    password: negativeActor.password,
    username: negativeActor.username,
  });

  try {
    const negativeUrl = new URL(
      '/iam/governance/legal-consents/export',
      input.config.acceptance.baseUrl
    );
    negativeUrl.searchParams.set('instanceId', input.config.acceptance.instanceId);
    negativeUrl.searchParams.set('format', 'json');
    const negativeResponse = await negativeSession.context.request.get(negativeUrl.toString(), {
      failOnStatusCode: false,
    });
    const negativeBody = await fetchText(negativeResponse);
    const negativeArtifact = await writeTextArtifact({
      contents: negativeBody,
      description: 'WP-006 negativer Consent-Export ohne Berechtigung',
      filename: 'wp-006-consent-export-negative.json',
      kind: 'json',
      reportDirectory: input.reportDirectory,
      runPaths: input.runPaths,
    });

    recordCase({
      packageId: 'WP-006',
      title: 'Negativfall ohne Exportberechtigung',
      status: negativeResponse.status() === 403 ? 'passed' : 'failed',
      details:
        negativeResponse.status() === 403
          ? 'Consent-Export ohne Berechtigung wurde korrekt mit HTTP 403 abgelehnt.'
          : `Consent-Export ohne Berechtigung antwortete mit HTTP ${negativeResponse.status()}.`,
      artifacts: [
        negativeArtifact,
        await writeTextArtifact({
          contents: `${JSON.stringify({ status: negativeResponse.status(), headers: negativeResponse.headers() }, null, 2)}\n`,
          description: 'WP-006 Metadaten des negativen Exports',
          filename: 'wp-006-consent-export-negative.meta.json',
          kind: 'json',
          reportDirectory: input.reportDirectory,
          runPaths: input.runPaths,
        }),
      ],
    });
  } finally {
    await negativeSession.page.close().catch(() => undefined);
    await negativeSession.context.close().catch(() => undefined);
  }
};

export const runWp006Evidence = async (input: Wp006Input): Promise<void> => {
  const { recordCase } = input;
  const memberSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Instanz-Benutzer',
    password: input.config.instanceActor.password,
    username: input.config.instanceActor.username,
  });

  try {
    await memberSession.page.goto(
      new URL('/account/privacy', input.config.acceptance.baseUrl).toString(),
      {
        timeout: READINESS_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      }
    );
    await memberSession.page.waitForLoadState('networkidle');

    const consentScreenshot = await captureScreenshot({
      description: 'WP-006 Privacy-Seite oder blockierender Consent-Dialog',
      filename: 'wp-006-privacy-consent.png',
      page: memberSession.page,
      reportDirectory: input.reportDirectory,
      runPaths: input.runPaths,
    });

    const hasConsentDialog = await hasVisibleText(
      memberSession.page,
      /Bitte Rechtstexte akzeptieren/i
    );
    recordCase({
      packageId: 'WP-006',
      title: 'Blockierender Consent-Fall',
      status: hasConsentDialog ? 'passed' : 'manual_review',
      details: hasConsentDialog
        ? 'Der blockierende Rechtstext-Dialog war im Live-Lauf sichtbar.'
        : 'Privacy-Seite wurde archiviert; ein blockierender Consent-Dialog war im Lauf nicht automatisch sichtbar.',
      artifacts: [consentScreenshot],
    });

    await runPositiveExport(input);

    if (!input.config.negativeActor) {
      recordCase({
        packageId: 'WP-006',
        title: 'Negativfall ohne Exportberechtigung',
        status: 'manual_review',
        details:
          'Kein separater nicht privilegierter Testnutzer konfiguriert. Für den echten Negativnachweis `IAM_EVIDENCE_NEGATIVE_USERNAME` und `IAM_EVIDENCE_NEGATIVE_PASSWORD` setzen.',
      });
      return;
    }
    await runNegativeExport(input, input.config.negativeActor);
  } finally {
    await memberSession.page.close().catch(() => undefined);
    await memberSession.context.close().catch(() => undefined);
  }
};
