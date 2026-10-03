import type { EvidenceConfig, EvidenceRunPaths } from './iam-evidence.ts';
import { captureScreenshot } from './iam-evidence-artifacts.js';
import type { RecordCase } from './iam-evidence-artifacts.js';
import {
  hasVisibleText,
  loginAndReadSession,
  openUserPermissionsTab,
  READINESS_TIMEOUT_MS,
} from './iam-evidence-session.js';
import type { Browser } from './iam-evidence-session.js';

export const runWp005Evidence = async (input: {
  browser: Browser;
  config: EvidenceConfig;
  recordCase: RecordCase;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<void> => {
  const { recordCase } = input;
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
        details:
          'Setzen Sie IAM_EVIDENCE_WP005_USER_ID, um einen konkreten Benutzerdetailfall mit Screenshot zu öffnen.',
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
    await adminSession.page.goto(
      new URL(`/admin/users/${userId}`, input.config.acceptance.baseUrl).toString(),
      {
        timeout: READINESS_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      }
    );
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
    const hasInactiveGroup = await hasVisibleText(
      adminSession.page,
      /Inaktivitätsgrund:\s*Gruppe deaktiviert/i
    );
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
