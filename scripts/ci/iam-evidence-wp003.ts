import type { EvidenceConfig, EvidenceRunPaths } from './iam-evidence.ts';
import { captureScreenshot, writeTextArtifact } from './iam-evidence-artifacts.js';
import type { RecordCase } from './iam-evidence-artifacts.js';
import {
  hasVisibleText,
  loginAndReadSession,
  READINESS_TIMEOUT_MS,
} from './iam-evidence-session.js';
import type { Browser, Pool } from './iam-evidence-session.js';

type OrganizationSeedRow = {
  depth: number;
  hierarchy_path: string[];
  organization_key: string;
};

export const runWp003Evidence = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  recordCase: RecordCase;
  pool: Pool;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<void> => {
  const { recordCase } = input;
  const adminSession = await loginAndReadSession({
    baseUrl: input.config.acceptance.baseUrl,
    browser: input.browser,
    name: 'Root-Admin',
    password: input.config.rootActor.password,
    username: input.config.rootActor.username,
  });

  try {
    await adminSession.page.goto(
      new URL('/admin/organizations', input.config.acceptance.baseUrl).toString(),
      {
        timeout: READINESS_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      }
    );
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

    const hasRoot = organizationRows.rows.some(
      (row) => row.organization_key === 'seed-org-default' && row.depth === 0
    );
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
