import {
  createMutationHeaders,
  openTenantContext,
  fillIfVisible,
  clickIfVisible,
} from './browser.js';
import type { AdminExplorationConfig } from './types.js';

type ApiResponsePayload = {
  readonly data?: {
    readonly invitation?: {
      readonly status?: string;
    };
    readonly user?: {
      readonly id?: string;
    };
  };
  readonly error?: {
    readonly message?: string;
  };
};

export function createTenantUserPayload(runToken: string) {
  const uniqueSuffix = runToken
    .slice(-12)
    .replace(/[^a-z0-9]/giu, '')
    .slice(-8);
  const email = `adminExploration.story18.${runToken}@example.invalid`;
  const firstName = 'AdminExploration';
  const lastName = `Loop${uniqueSuffix}`;
  const displayName = `${firstName} ${lastName}`;
  const idempotencyKey = `admin-exploration-story18-${runToken}`;

  return {
    displayName,
    email,
    firstName,
    idempotencyKey,
    lastName,
  };
}

export async function createTenantUser(
  context: import('@playwright/test').BrowserContext,
  tenantBaseUrl: string,
  user: ReturnType<typeof createTenantUserPayload>
): Promise<ApiResponsePayload & { readonly httpStatus: number }> {
  const response = await context.request.post(
    new URL('/api/v1/iam/users', tenantBaseUrl).toString(),
    {
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        roleIds: [],
        sendPasswordSetupEmail: false,
      },
      failOnStatusCode: false,
      headers: createMutationHeaders(tenantBaseUrl, user.idempotencyKey),
    }
  );
  const payload = (await response.json().catch(() => ({}))) as ApiResponsePayload;

  return {
    ...payload,
    httpStatus: response.status(),
  };
}

export async function verifyTenantUserVisible(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  userId: string,
  user: Pick<ReturnType<typeof createTenantUserPayload>, 'displayName' | 'email'>
): Promise<boolean> {
  await page.goto(new URL(`/admin/users/${userId}`, tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const pageContent = await page.textContent('body');

  return (
    (pageContent?.includes(user.email) ?? false) &&
    (pageContent?.includes(user.displayName) ?? false)
  );
}

export async function verifyTenantUserHiddenFromNeighbor(
  browser: import('@playwright/test').Browser,
  tenant: NonNullable<AdminExplorationConfig['tenant']>,
  userId: string,
  user: Pick<ReturnType<typeof createTenantUserPayload>, 'displayName' | 'email'>
): Promise<{ readonly verified: boolean; readonly details: readonly string[] }> {
  const neighbor = tenant.neighbor;

  if (neighbor === null) {
    return {
      verified: false,
      details: ['Nachbar-Mandant ist nicht konfiguriert.'],
    };
  }

  const { context, page } = await openTenantContext(browser, neighbor);
  const details: string[] = [];

  try {
    const apiResponse = await context.request.get(
      new URL(`/api/v1/iam/users/${userId}`, neighbor.baseUrl).toString(),
      {
        failOnStatusCode: false,
        headers: {
          Accept: 'application/json',
        },
      }
    );
    const apiDenied = apiResponse.status() === 403 || apiResponse.status() === 404;
    details.push(`Nachbar-Mandanten-API antwortete mit HTTP ${apiResponse.status()}.`);

    await page.goto(new URL(`/admin/users/${userId}`, neighbor.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');
    const uiHidden =
      (pageContent?.includes(user.email) ?? false) === false &&
      (pageContent?.includes(user.displayName) ?? false) === false;

    details.push(
      uiHidden
        ? 'Im Nachbar-Mandanten waren weder E-Mail noch Anzeigename sichtbar.'
        : 'Im Nachbar-Mandanten waren fremde Nutzerdaten sichtbar.'
    );

    return {
      verified: apiDenied && uiHidden,
      details,
    };
  } finally {
    await context.close();
  }
}

export async function createUserViaUi(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  user: ReturnType<typeof createTenantUserPayload>
): Promise<string> {
  await page.goto(new URL('/admin/users/new', tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const emailFilled = await fillIfVisible(page, ['#create-user-email'], user.email);
  const firstNameFilled = await fillIfVisible(page, ['#create-user-first-name'], user.firstName);
  const lastNameFilled = await fillIfVisible(page, ['#create-user-last-name'], user.lastName);

  if (emailFilled === false || firstNameFilled === false || lastNameFilled === false) {
    throw new Error('Die Nutzeranlage konnte in der UI nicht vollständig befüllt werden.');
  }

  const createClicked = await clickIfVisible(page, [{ kind: 'role', value: /nutzer anlegen/i }]);

  if (createClicked === false) {
    throw new Error('Der UI-Button für die Nutzeranlage wurde nicht gefunden.');
  }

  await page.waitForURL(/\/admin\/users\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/u, {
    timeout: 45_000,
  });
  await page.waitForLoadState('networkidle');

  const createdUserUrl = page.url();
  const userId = new URL(createdUserUrl).pathname.split('/').pop();

  if (userId === undefined || userId === '' || userId === 'new') {
    throw new Error(
      `Die Nutzeranlage führte nicht auf eine belastbare Detail-URL: ${createdUserUrl}`
    );
  }

  return userId;
}
