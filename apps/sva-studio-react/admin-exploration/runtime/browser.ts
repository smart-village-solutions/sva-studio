import type { createRolePayload } from './story-loop.roles.js';
import type { Browser } from '@playwright/test';

import type { AdminExplorationConfig } from './types.js';

export async function loadChromium() {
  return (await import('@playwright/test')).chromium;
}

export async function launchExplorationBrowser(config: AdminExplorationConfig): Promise<Browser> {
  const chromium = await loadChromium();

  return chromium.launch({ headless: config.localBrowser.headless });
}

async function loginTenantAdmin(
  page: import('@playwright/test').Page,
  tenant: { admin: { password: string; username: string }; baseUrl: string }
): Promise<void> {
  await page.goto(new URL('/auth/login', tenant.baseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await performKeycloakLogin(page, tenant.admin);
  await page.waitForURL(new RegExp(`${tenant.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`), {
    timeout: 45_000,
  });
  await page.waitForLoadState('networkidle');
}

export async function openTenantContext(
  browser: import('@playwright/test').Browser,
  tenant: { admin: { password: string; username: string }; baseUrl: string }
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginTenantAdmin(page, tenant);

  return {
    context,
    page,
  };
}

export async function fillIfVisible(
  page: import('@playwright/test').Page,
  selectors: readonly string[],
  value: string
): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);

    if (count === 0) {
      continue;
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    if (isVisible === false) {
      continue;
    }

    await first.fill(value);
    return true;
  }

  return false;
}

export async function clickIfVisible(
  page: import('@playwright/test').Page,
  selectors: readonly (
    | { kind: 'css'; value: string }
    | { kind: 'role'; role?: 'button' | 'tab'; value: string | RegExp }
  )[]
): Promise<boolean> {
  for (const selector of selectors) {
    const locator =
      selector.kind === 'css'
        ? page.locator(selector.value)
        : page.getByRole(selector.role ?? 'button', { name: selector.value });
    const count = await locator.count().catch(() => 0);

    if (count === 0) {
      continue;
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    if (isVisible === false) {
      continue;
    }

    await first.click();
    return true;
  }

  return false;
}

export async function createRoleViaUi(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  role: ReturnType<typeof createRolePayload>
): Promise<string> {
  await page.goto(new URL('/admin/roles/new', tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const roleKeyFilled = await fillIfVisible(page, ['#create-role-key'], role.roleName);
  const roleNameFilled = await fillIfVisible(page, ['#create-role-name'], role.displayName);
  const roleDescriptionFilled = await fillIfVisible(
    page,
    ['#create-role-description'],
    role.description
  );
  const roleLevelFilled = await fillIfVisible(page, ['#create-role-level'], String(role.roleLevel));

  if (
    roleKeyFilled === false ||
    roleNameFilled === false ||
    roleDescriptionFilled === false ||
    roleLevelFilled === false
  ) {
    throw new Error('Die Rollenanlage konnte in der UI nicht vollständig befüllt werden.');
  }

  const createClicked = await clickIfVisible(page, [{ kind: 'role', value: /rolle anlegen/i }]);

  if (createClicked === false) {
    throw new Error('Der UI-Button für die Rollenanlage wurde nicht gefunden.');
  }

  await page.waitForURL(/\/admin\/roles\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/u, {
    timeout: 45_000,
  });
  await page.waitForLoadState('networkidle');

  const createdRoleUrl = page.url();
  const roleId = new URL(createdRoleUrl).pathname.split('/').pop();

  if (roleId === undefined || roleId === '' || roleId === 'new') {
    throw new Error(
      `Die Rollenanlage führte nicht auf eine belastbare Detail-URL: ${createdRoleUrl}`
    );
  }

  return roleId;
}

export async function assignRoleToUserViaUi(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  roleId: string,
  userEmail: string
): Promise<void> {
  await page.goto(new URL(`/admin/roles/${roleId}`, tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const assignmentsTabClicked = await clickIfVisible(page, [
    { kind: 'role', role: 'tab', value: /zuweisungen/i },
  ]);

  if (assignmentsTabClicked === false) {
    throw new Error('Der Zuweisungen-Tab der Rollen-Detailseite wurde nicht gefunden.');
  }

  await page.waitForLoadState('networkidle');

  const searchFilled = await fillIfVisible(page, ['#role-assignment-search'], userEmail);

  if (searchFilled === false) {
    throw new Error('Die Benutzer-Suche im Rollen-Zuweisungsbereich wurde nicht gefunden.');
  }

  await page.waitForLoadState('networkidle');

  const assignClicked = await clickIfVisible(page, [{ kind: 'role', value: /zuweisen/i }]);

  if (assignClicked === false) {
    throw new Error('Der UI-Button für die Rollenzuweisung wurde nicht gefunden.');
  }

  await page.waitForLoadState('networkidle');
}

async function performKeycloakLogin(
  page: import('@playwright/test').Page,
  credentials: { password: string; username: string }
): Promise<void> {
  const usernameFilled = await fillIfVisible(
    page,
    ['input[name="username"]', '#username'],
    credentials.username
  );
  const passwordFilled = await fillIfVisible(
    page,
    ['input[name="password"]', '#password'],
    credentials.password
  );

  if (usernameFilled === false || passwordFilled === false) {
    throw new Error('Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.');
  }

  const clicked = await clickIfVisible(page, [
    { kind: 'css', value: '#kc-login' },
    { kind: 'role', value: /anmelden|sign in|login/i },
  ]);

  if (clicked === false) {
    throw new Error('Der Keycloak-Login-Button wurde nicht gefunden.');
  }
}

export function createMutationHeaders(
  baseUrl: string,
  idempotencyKey: string
): Record<string, string> {
  const origin = new URL(baseUrl).origin;

  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: origin,
    Referer: `${origin}/`,
    'Idempotency-Key': idempotencyKey,
  };
}
