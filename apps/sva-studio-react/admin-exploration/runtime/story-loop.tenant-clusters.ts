import { openTenantContext } from './browser.js';
import {
  createTenantUserPayload,
  createTenantUser,
  verifyTenantUserVisible,
  verifyTenantUserHiddenFromNeighbor,
} from './story-loop.users.js';
import {
  defaultEvidenceForCluster,
  type AdminExplorationStoryCluster,
  type AdminExplorationStoryEvidenceInput,
} from './story-loop.evidence.js';
import type { AdminExplorationConfig } from './types.js';

type BrowserModule = typeof import('@playwright/test');

export async function executeTenantUserCreateCluster(
  config: AdminExplorationConfig,
  cluster: AdminExplorationStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly AdminExplorationStoryEvidenceInput[]> {
  if (config.tenant === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes: 'Tenant-Konfiguration fehlt; Story kann lokal nicht automatisch geprüft werden.',
    }));
  }

  const tenant = config.tenant;
  const chromium = await chromiumFactory();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/gu, '')
    .slice(0, 14);
  const user = createTenantUserPayload(`tenant-user-create-${timestamp}`);

  try {
    const { context, page } = await openTenantContext(browser, tenant);
    const responsePayload = await createTenantUser(context, tenant.baseUrl, user);

    if (responsePayload.httpStatus !== 201 || responsePayload.data?.user?.id === undefined) {
      return failedTenantUserCreationEvidence(cluster, responsePayload);
    }

    const userId = responsePayload.data.user.id;
    const visibleInTenant = await verifyTenantUserVisible(page, tenant.baseUrl, userId, user);

    if (visibleInTenant === false) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        coverage: 'nachweis_fehlend',
        notes:
          'Nutzer wurde erzeugt, konnte aber in der Detailansicht nicht eindeutig nachgewiesen werden.',
        findings: [
          `User-ID ${userId} wurde erstellt, aber Name/E-Mail waren nicht in /admin/users/${userId} sichtbar.`,
        ],
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'missing',
        },
      }));
    }

    return cluster.stories.map((story) => ({
      storyId: story.id,
      coverage: 'luecke',
      notes: `Tenant-Nachweis über User ${user.email} auf ${tenant.baseUrl}/admin/users/${userId}; tenant-übergreifender Negativnachweis fehlt noch.`,
      findings: [
        `Nutzer ${user.email} wurde im Tenant erfolgreich angelegt.`,
        `Die Detailansicht /admin/users/${userId} zeigte Name und E-Mail.`,
        `Passwort-Einladung wurde mit Status ${responsePayload.data?.invitation?.status ?? 'not_requested'} verarbeitet.`,
        'Ein Negativnachweis gegen einen Nachbar-Mandanten wurde in diesem Executor noch nicht geführt.',
      ],
      verification: {
        environment: 'adequate',
        negative: 'missing',
        positive: 'verified',
      },
    }));
  } finally {
    await browser.close();
  }
}

export async function executeTenantIsolationCluster(
  config: AdminExplorationConfig,
  cluster: AdminExplorationStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly AdminExplorationStoryEvidenceInput[]> {
  if (config.tenant === null || config.tenant.neighbor === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes:
        'Tenant- oder Nachbar-Mandanten-Konfiguration fehlt; Isolation kann lokal nicht ehrlich geprüft werden.',
    }));
  }

  const tenant = config.tenant;
  const chromium = await chromiumFactory();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/gu, '')
    .slice(0, 14);
  const user = createTenantUserPayload(`tenant-isolation-${timestamp}`);

  try {
    const { context, page } = await openTenantContext(browser, tenant);
    const responsePayload = await createTenantUser(context, tenant.baseUrl, user);

    if (responsePayload.httpStatus !== 201 || responsePayload.data?.user?.id === undefined) {
      return failedTenantIsolationCreationEvidence(cluster, responsePayload);
    }

    const userId = responsePayload.data.user.id;
    const visibleInTenant = await verifyTenantUserVisible(page, tenant.baseUrl, userId, user);

    if (visibleInTenant === false) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        coverage: 'nachweis_fehlend',
        notes:
          'Isolationstest konnte die erzeugten Ausgangsdaten im Ausgangsmandanten nicht sichtbar reproduzieren.',
        findings: [`User-ID ${userId} war im Ausgangsmandanten nicht sichtbar.`],
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'missing',
        },
      }));
    }

    const negativeProof = await verifyTenantUserHiddenFromNeighbor(browser, tenant, userId, user);

    return cluster.stories.map((story) => ({
      storyId: story.id,
      coverage: negativeProof.verified ? 'vorhanden' : 'luecke',
      notes: negativeProof.verified
        ? `Mandantentrennung für User ${user.email} zwischen ${tenant.baseUrl} und ${tenant.neighbor?.baseUrl} nachgewiesen.`
        : `Ausgangsmandant sichtbar, aber Negativnachweis gegen ${tenant.neighbor?.baseUrl} blieb unvollständig.`,
      findings: [
        `Nutzer ${user.email} war im Ausgangsmandanten sichtbar.`,
        ...negativeProof.details,
      ],
      verification: {
        environment: 'adequate',
        negative: negativeProof.verified ? 'verified' : 'missing',
        positive: 'verified',
      },
    }));
  } finally {
    await browser.close();
  }
}

function failedTenantUserCreationEvidence(
  cluster: AdminExplorationStoryCluster,
  responsePayload: Awaited<ReturnType<typeof createTenantUser>>
): readonly AdminExplorationStoryEvidenceInput[] {
  return cluster.stories.map((story) => ({
    storyId: story.id,
    coverage: 'nachweis_fehlend',
    notes:
      responsePayload.error?.message ??
      `Nutzeranlage antwortete mit HTTP ${responsePayload.httpStatus} und lieferte keine belastbare User-ID.`,
    findings: [
      `Tenant-Create-Call fehlgeschlagen: HTTP ${responsePayload.httpStatus}.`,
      'Die Story konnte lokal nicht positiv nachgewiesen werden.',
    ],
    verification: {
      environment: 'adequate',
      negative: 'missing',
      positive: 'missing',
    },
  }));
}

function failedTenantIsolationCreationEvidence(
  cluster: AdminExplorationStoryCluster,
  responsePayload: Awaited<ReturnType<typeof createTenantUser>>
): readonly AdminExplorationStoryEvidenceInput[] {
  return cluster.stories.map((story) => ({
    storyId: story.id,
    coverage: 'nachweis_fehlend',
    notes:
      responsePayload.error?.message ??
      `Isolationstest konnte den Ausgangsnutzer nicht anlegen: HTTP ${responsePayload.httpStatus}.`,
    findings: [
      `Tenant-Create-Call für Isolationstest fehlgeschlagen: HTTP ${responsePayload.httpStatus}.`,
    ],
    verification: {
      environment: 'adequate',
      negative: 'missing',
      positive: 'missing',
    },
  }));
}
