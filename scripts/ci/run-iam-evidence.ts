import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

import {
  parseAcceptanceConfig,
  type AcceptanceFailureCode,
} from './iam-acceptance.ts';
import {
  buildEvidenceReport,
  createEvidenceArtifactPath,
  createEvidenceRunPaths,
  parseEvidenceConfig,
  writeEvidenceReports,
  type EvidenceArtifact,
  type EvidenceCaseRecord,
  type EvidenceConfig,
  type EvidencePackageId,
  type EvidenceRunPaths,
} from './iam-evidence.ts';

type BrowserModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<Browser>;
  };
};

type Browser = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContext>;
};

type BrowserContext = {
  close: () => Promise<void>;
  newPage: () => Promise<Page>;
  request: {
    get: (url: string, options?: { failOnStatusCode?: boolean; headers?: Record<string, string> }) => Promise<ApiResponse>;
  };
};

type ApiResponse = {
  headers: () => Record<string, string>;
  status: () => number;
  text: () => Promise<string>;
};

type Locator = {
  click: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  first: () => Locator;
  isVisible: () => Promise<boolean>;
};

type Page = {
  close: () => Promise<void>;
  getByRole: (role: string, options?: { exact?: boolean; name?: string | RegExp }) => Locator;
  getByText: (text: string | RegExp) => Locator;
  goto: (url: string, options?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }) => Promise<unknown>;
  locator: (selector: string) => Locator;
  screenshot: (options: { fullPage?: boolean; path: string }) => Promise<void>;
  waitForLoadState: (state?: 'domcontentloaded' | 'load' | 'networkidle') => Promise<void>;
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
};

type PgModule = {
  Pool: new (options: { connectionString: string }) => Pool;
};

type Pool = {
  end: () => Promise<void>;
  query: <T>(text: string, values?: readonly unknown[]) => Promise<{ rowCount: number | null; rows: T[] }>;
};

type AuthMePayload = {
  user?: {
    email?: string;
    id?: string;
    instanceId?: string;
    name?: string;
    roles?: string[];
  };
};

type OrganizationSeedRow = {
  depth: number;
  hierarchy_path: string[];
  organization_key: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../..');
const appRequire = createRequire(resolve(rootDir, 'apps/sva-studio-react/package.json'));
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));

const { chromium } = appRequire('@playwright/test') as BrowserModule;
const { Pool } = authRuntimeRequire('pg') as PgModule;

const READINESS_TIMEOUT_MS = 45_000;

const reportCases: EvidenceCaseRecord[] = [];

const recordCase = (entry: EvidenceCaseRecord): EvidenceCaseRecord => {
  reportCases.push(entry);
  console.log(`[iam-evidence] ${entry.status.toUpperCase()} ${entry.packageId} ${entry.title}`);
  return entry;
};

const failRun = (message: string, failureCode: AcceptanceFailureCode): never => {
  throw new Error(`${failureCode}: ${message}`);
};

const fetchText = async (response: ApiResponse): Promise<string> => response.text();

const countVisible = async (locator: Locator): Promise<number> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return 0;
  }
  const first = locator.first();
  return (await first.isVisible().catch(() => false)) ? count : 0;
};

const hasVisibleText = async (page: Page, text: string | RegExp): Promise<boolean> =>
  (await countVisible(page.getByText(text))) > 0;

const fillIfVisible = async (locator: Locator, value: string): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return false;
  }

  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) {
    return false;
  }

  await first.fill(value);
  return true;
};

const clickIfVisible = async (locator: Locator): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return false;
  }

  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) {
    return false;
  }

  await first.click();
  return true;
};

const performKeycloakLogin = async (page: Page, input: { password: string; username: string }): Promise<void> => {
  const usernameFilled =
    (await fillIfVisible(page.locator('input[name="username"]'), input.username)) ||
    (await fillIfVisible(page.locator('#username'), input.username));
  const passwordFilled =
    (await fillIfVisible(page.locator('input[name="password"]'), input.password)) ||
    (await fillIfVisible(page.locator('#password'), input.password));

  if (!usernameFilled || !passwordFilled) {
    failRun('Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.', 'acceptance_login_failed');
  }

  const clicked =
    (await clickIfVisible(page.locator('#kc-login'))) ||
    (await clickIfVisible(page.getByRole('button', { name: /anmelden|sign in|login/i })));
  if (!clicked) {
    failRun('Der Keycloak-Login-Button wurde nicht gefunden.', 'acceptance_login_failed');
  }
};

const loginAndReadSession = async (input: {
  baseUrl: string;
  browser: Browser;
  name: string;
  password: string;
  username: string;
}): Promise<{
  context: BrowserContext;
  page: Page;
  user: NonNullable<AuthMePayload['user']>;
}> => {
  const context = await input.browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL('/auth/login', input.baseUrl).toString(), {
      timeout: READINESS_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(page, { username: input.username, password: input.password });
    await page.waitForURL(new RegExp(`${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`), {
      timeout: READINESS_TIMEOUT_MS,
    });
    await page.waitForLoadState('networkidle');

    const meResponse = await context.request.get(new URL('/auth/me', input.baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (meResponse.status() !== 200) {
      failRun(`/auth/me antwortete mit HTTP ${meResponse.status()}.`, 'acceptance_http_request_failed');
    }

    const mePayload = JSON.parse(await meResponse.text()) as AuthMePayload;
    const user = mePayload.user;
    if (!user?.id || !user.instanceId || !Array.isArray(user.roles)) {
      failRun('Der User-Kontext aus /auth/me ist unvollständig.', 'acceptance_expected_claim_missing');
    }

    return {
      context,
      page,
      user: user as NonNullable<AuthMePayload['user']>,
    };
  } catch (error) {
    await context.close().catch(() => undefined);
    failRun(error instanceof Error ? error.message : String(error), 'acceptance_login_failed');
  }

  throw new Error('unreachable');
};

const createArtifact = (input: {
  description: string;
  filename: string;
  kind: EvidenceArtifact['kind'];
  runPaths: EvidenceRunPaths;
  reportDirectory: string;
}): { absolutePath: string; artifact: EvidenceArtifact } => {
  const pathInfo = createEvidenceArtifactPath({
    artifactDirectory: input.runPaths.artifactDirectory,
    filename: input.filename,
    reportDirectory: input.reportDirectory,
  });

  return {
    absolutePath: pathInfo.absolutePath,
    artifact: {
      description: input.description,
      kind: input.kind,
      path: pathInfo.relativePath,
    },
  };
};

const captureScreenshot = async (input: {
  description: string;
  filename: string;
  page: Page;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<EvidenceArtifact> => {
  const artifact = createArtifact({
    description: input.description,
    filename: input.filename,
    kind: 'screenshot',
    reportDirectory: input.reportDirectory,
    runPaths: input.runPaths,
  });
  await mkdir(input.runPaths.artifactDirectory, { recursive: true });
  await input.page.screenshot({ fullPage: true, path: artifact.absolutePath });
  return artifact.artifact;
};

const openUserPermissionsTab = async (page: Page): Promise<void> => {
  const permissionsTab = page.getByRole('tab', { name: /Berechtigungen/i });
  const tabVisible = (await countVisible(permissionsTab)) > 0;
  if (!tabVisible) {
    return;
  }

  await permissionsTab.first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
};

const writeTextArtifact = async (input: {
  contents: string;
  description: string;
  filename: string;
  kind: EvidenceArtifact['kind'];
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<EvidenceArtifact> => {
  const artifact = createArtifact({
    description: input.description,
    filename: input.filename,
    kind: input.kind,
    reportDirectory: input.reportDirectory,
    runPaths: input.runPaths,
  });
  await mkdir(input.runPaths.artifactDirectory, { recursive: true });
  await writeFile(artifact.absolutePath, input.contents, 'utf8');
  return artifact.artifact;
};

const runWp003Evidence = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  pool: Pool;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<void> => {
  const adminSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Root-Admin',
    password: input.config.rootActor.password,
    username: input.config.rootActor.username,
  });

  try {
    await adminSession.page.goto(new URL('/admin/organizations', input.config.acceptance.baseUrl).toString(), {
      timeout: READINESS_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await adminSession.page.waitForLoadState('networkidle');

    const overviewScreenshot = await captureScreenshot({
      description: 'WP-003 Organisationsübersicht',
      filename: 'wp-003-organizations-overview.png',
      page: adminSession.page,
      reportDirectory: input.reportDirectory,
      runPaths: input.runPaths,
    });

    const hasOverviewMarker =
      (await hasVisibleText(adminSession.page, /Organisation anlegen/i)) ||
      (await hasVisibleText(adminSession.page, /Organisationen/i));

    recordCase({
      packageId: 'WP-003',
      title: 'Organisationsübersicht der Zielumgebung',
      status: hasOverviewMarker ? 'passed' : 'failed',
      details: hasOverviewMarker
        ? 'Admin-UI für Organisationen war erreichbar und wurde mit Screenshot archiviert.'
        : 'Die Organisationsansicht war erreichbar, aber zentrale UI-Marker wurden nicht gefunden.',
      artifacts: [overviewScreenshot],
    });

    const organizationRows = await input.pool.query<OrganizationSeedRow>(
      `
SELECT organization_key, depth, hierarchy_path
FROM iam.organizations
WHERE instance_id = $1
ORDER BY depth ASC, organization_key ASC
LIMIT 50;
`,
      [input.config.acceptance.instanceId]
    );

    const hasRoot = organizationRows.rows.some((row) => row.organization_key === 'seed-org-default' && row.depth === 0);
    const hasHierarchy = organizationRows.rows.some(
      (row) => row.depth > 0 && Array.isArray(row.hierarchy_path) && row.hierarchy_path.length > 1
    );

    recordCase({
      packageId: 'WP-003',
      title: 'Seed-Hierarchie der Zielinstanz',
      status: hasRoot && hasHierarchy ? 'passed' : 'failed',
      details:
        hasRoot && hasHierarchy
          ? 'Root-Organisation und mindestens ein hierarchischer Nachfolger wurden in der IAM-Datenbank gefunden.'
          : 'Root-Organisation oder Hierarchie-Nachfolger fehlen im aktuellen DB-Snapshot.',
      artifacts: [
        await writeTextArtifact({
          contents: `${JSON.stringify(organizationRows.rows, null, 2)}\n`,
          description: 'WP-003 DB-Snapshot der Organisationshierarchie',
          filename: 'wp-003-organizations-db-snapshot.json',
          kind: 'json',
          reportDirectory: input.reportDirectory,
          runPaths: input.runPaths,
        }),
      ],
    });

    recordCase({
      packageId: 'WP-003',
      title: 'Parent-Child-Anlage und Re-Zuordnung',
      status: 'manual_review',
      details:
        'Die Ablage ist vorbereitet. Führen Sie den Zielumgebungsfall aus und ergänzen Sie denselben Artefaktordner um Screenshots für Anlage und Re-Zuordnung.',
      artifacts: [overviewScreenshot],
    });

    recordCase({
      packageId: 'WP-003',
      title: 'Tenant-Grenzen oder Negativpfad',
      status: 'manual_review',
      details:
        'Der Negativfall bleibt umgebungsabhängig. Der Bericht und der Artefaktordner sind normiert; ergänzen Sie dort den Sperr- oder Fehlermeldungsnachweis.',
      artifacts: [overviewScreenshot],
    });
  } finally {
    await adminSession.page.close().catch(() => undefined);
    await adminSession.context.close().catch(() => undefined);
  }
};

const runWp005Evidence = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<void> => {
  const userId = input.config.wp005.userId;
  if (!userId) {
    for (const title of [
      'Mehrfachherkunft direkt plus Gruppe',
      'Deaktivierte oder soft-gelöschte Gruppe',
      'Gültigkeitsfenster einer Zuweisung',
      'Geo Parent-Allow mit Child-Deny',
    ]) {
      recordCase({
        packageId: 'WP-005',
        title,
        status: 'skipped',
        details: 'Setzen Sie IAM_EVIDENCE_WP005_USER_ID, um einen konkreten Benutzerdetailfall mit Screenshot zu öffnen.',
      });
    }
    return;
  }

  const adminSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Root-Admin',
    password: input.config.rootActor.password,
    username: input.config.rootActor.username,
  });

  try {
    await adminSession.page.goto(new URL(`/admin/users/${userId}`, input.config.acceptance.baseUrl).toString(), {
      timeout: READINESS_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await adminSession.page.waitForLoadState('networkidle');
    await openUserPermissionsTab(adminSession.page);

    const detailScreenshot = await captureScreenshot({
      description: 'WP-005 Benutzerdetail mit permissionTrace',
      filename: 'wp-005-user-detail-permission-trace.png',
      page: adminSession.page,
      reportDirectory: input.reportDirectory,
      runPaths: input.runPaths,
    });

    const hasPermissionTrace = await hasVisibleText(adminSession.page, /Effektive Berechtigungen/i);
    const hasGroupMarker = await hasVisibleText(adminSession.page, /Gruppe/i);
    const hasDirectMarker =
      (await hasVisibleText(adminSession.page, /Direkte Rolle/i)) ||
      (await hasVisibleText(adminSession.page, /Direkte Berechtigung/i));
    const hasInactiveGroup = await hasVisibleText(adminSession.page, /Inaktivitätsgrund:\s*Gruppe deaktiviert/i);
    const hasValidity =
      (await hasVisibleText(adminSession.page, /Gültigkeit:/i)) ||
      (await hasVisibleText(adminSession.page, /Gültigkeit ab/i)) ||
      (await hasVisibleText(adminSession.page, /Gültigkeit bis/i));
    const hasGeoAllow = await hasVisibleText(adminSession.page, /Geo-Freigabe ab:/i);
    const hasGeoDeny = await hasVisibleText(adminSession.page, /Geo-Restriktion:/i);

    recordCase({
      packageId: 'WP-005',
      title: 'Mehrfachherkunft direkt plus Gruppe',
      status: hasPermissionTrace && hasGroupMarker && hasDirectMarker ? 'passed' : 'manual_review',
      details:
        hasPermissionTrace && hasGroupMarker && hasDirectMarker
          ? 'permissionTrace zeigt sowohl direkte als auch gruppenbasierte Herkunft in derselben Detailansicht.'
          : 'Benutzerdetail wurde archiviert; die Mehrfachherkunft muss im Screenshot manuell bestätigt werden.',
      artifacts: [detailScreenshot],
    });

    recordCase({
      packageId: 'WP-005',
      title: 'Deaktivierte oder soft-gelöschte Gruppe',
      status: hasInactiveGroup ? 'passed' : 'manual_review',
      details: hasInactiveGroup
        ? 'Der Inaktivitätsgrund "Gruppe deaktiviert" war in der Detailansicht sichtbar.'
        : 'Detailansicht wurde archiviert; ein expliziter Inaktivitätsgrund war im Lauf nicht automatisch auffindbar.',
      artifacts: [detailScreenshot],
    });

    recordCase({
      packageId: 'WP-005',
      title: 'Gültigkeitsfenster einer Zuweisung',
      status: hasValidity ? 'passed' : 'manual_review',
      details: hasValidity
        ? 'Mindestens ein Gültigkeitsmarker war in der Detailansicht sichtbar.'
        : 'Detailansicht wurde archiviert; Gültigkeitsfenster müssen anhand des Screenshots geprüft werden.',
      artifacts: [detailScreenshot],
    });

    recordCase({
      packageId: 'WP-005',
      title: 'Geo Parent-Allow mit Child-Deny',
      status: hasGeoAllow && hasGeoDeny ? 'passed' : 'manual_review',
      details:
        hasGeoAllow && hasGeoDeny
          ? 'Geo-Freigabe und Geo-Restriktion waren gleichzeitig sichtbar.'
          : 'Detailansicht wurde archiviert; der Geo-Konfliktfall muss anhand des Screenshots oder eines gezielten Beispieldatensatzes geprüft werden.',
      artifacts: [detailScreenshot],
    });
  } finally {
    await adminSession.page.close().catch(() => undefined);
    await adminSession.context.close().catch(() => undefined);
  }
};

const runWp006Evidence = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<void> => {
  const memberSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Instanz-Benutzer',
    password: input.config.instanceActor.password,
    username: input.config.instanceActor.username,
  });

  try {
    await memberSession.page.goto(new URL('/account/privacy', input.config.acceptance.baseUrl).toString(), {
      timeout: READINESS_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await memberSession.page.waitForLoadState('networkidle');

    const consentScreenshot = await captureScreenshot({
      description: 'WP-006 Privacy-Seite oder blockierender Consent-Dialog',
      filename: 'wp-006-privacy-consent.png',
      page: memberSession.page,
      reportDirectory: input.reportDirectory,
      runPaths: input.runPaths,
    });

    const hasConsentDialog = await hasVisibleText(memberSession.page, /Bitte Rechtstexte akzeptieren/i);
    recordCase({
      packageId: 'WP-006',
      title: 'Blockierender Consent-Fall',
      status: hasConsentDialog ? 'passed' : 'manual_review',
      details: hasConsentDialog
        ? 'Der blockierende Rechtstext-Dialog war im Live-Lauf sichtbar.'
        : 'Privacy-Seite wurde archiviert; ein blockierender Consent-Dialog war im Lauf nicht automatisch sichtbar.',
      artifacts: [consentScreenshot],
    });

    const adminSession = await loginAndReadSession({
      baseUrl: input.config.acceptance.baseUrl,
      browser: input.browser,
      name: 'Root-Admin',
      password: input.config.rootActor.password,
      username: input.config.rootActor.username,
    });

    try {
      const exportUrl = new URL('/iam/governance/legal-consents/export', input.config.acceptance.baseUrl);
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

    const negativeSession = await loginAndReadSession({
      baseUrl: input.config.acceptance.baseUrl,
      browser: input.browser,
      name: 'Negativfall-Benutzer',
      password: input.config.negativeActor.password,
      username: input.config.negativeActor.username,
    });

    try {
      const negativeUrl = new URL('/iam/governance/legal-consents/export', input.config.acceptance.baseUrl);
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
  } finally {
    await memberSession.page.close().catch(() => undefined);
    await memberSession.context.close().catch(() => undefined);
  }
};

const runEvidencePackage = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  packageId: EvidencePackageId;
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
    const reportDirectory = resolve(rootDir, process.env.IAM_EVIDENCE_REPORT_DIR?.trim() || 'docs/reports');
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
