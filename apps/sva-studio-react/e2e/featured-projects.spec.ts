import { expect, test } from '@playwright/test';

import {
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
} from './news-plugin.fixtures';

const projectUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    assignedModules: ['projects'],
    roles: ['editor'],
    permissionActions: ['projects.read', 'projects.create', 'projects.update', 'projects.delete'],
  },
};

const projectPermissions = {
  instanceId: 'de-musterhausen',
  permissions: ['read', 'create', 'update', 'delete'].map((action) => ({
    action: `projects.${action}`,
    resourceType: 'projects',
  })),
  subject: { actorUserId: 'kc-editor-1', effectiveUserId: 'kc-editor-1', isImpersonating: false },
  evaluatedAt: '2026-08-03T12:00:00.000Z',
};

test('creates, publishes, reorders and deletes a featured project with multiple images', async ({ page }) => {
  await mockSharedShellRequests(page);
  let project: Record<string, unknown> | undefined;
  let deleted = false;
  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectUser) })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectPermissions) })
  );
  await page.route('**/api/v1/iam/media**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );
  await page.route('**/api/v1/mainserver/projects**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.method() === 'GET' ? undefined : (request.postDataJSON() as Record<string, unknown>);
    if (request.method() === 'POST') {
      project = {
        ...body,
        id: 'project-1',
        published: body?.status === 'published',
        publishedAt: body?.status === 'published' ? '2026-08-03T12:00:00.000Z' : undefined,
        deleted: false,
        createdAt: '2026-08-03T12:00:00.000Z',
        updatedAt: '2026-08-03T12:00:00.000Z',
      };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: project }) });
    }
    if (path.endsWith('/project-1') && request.method() === 'GET') {
      return route.fulfill({ status: project && !deleted ? 200 : 404, contentType: 'application/json', body: JSON.stringify(project && !deleted ? { data: project } : { error: 'not_found' }) });
    }
    if (path.endsWith('/project-1') && request.method() === 'PATCH') {
      project = {
        ...project,
        ...body,
        published: body?.status === 'published',
        publishedAt: body?.status === 'published' ? '2026-08-03T12:30:00.000Z' : undefined,
        updatedAt: '2026-08-03T12:30:00.000Z',
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: project }) });
    }
    if (path.endsWith('/project-1') && request.method() === 'DELETE') {
      deleted = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'project-1' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 25, total: 0, hasNextPage: false } }) });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/projects/new');
  await page.locator('#project-language').fill('de-x-kommunal');
  await page.locator('#project-title').fill('Neue Brücke');
  await page.locator('#project-description').fill('Projektbeschreibung');
  await page.getByRole('tab', { name: /Inhalt|projects\.tabs\.content/ }).click();
  await page.locator('#project-fullText').fill('Ausführlicher Projekttext');
  await page.getByRole('button', { name: /Bild hinzufügen|projects\.actions\.addImage/ }).click();
  await page.getByRole('button', { name: /Bild hinzufügen|projects\.actions\.addImage/ }).click();
  await page.locator('#project-image-url-0').fill('https://example.test/one.jpg');
  await page.locator('#project-image-alt-0').fill('Brücke');
  await page.locator('#project-image-url-1').fill('https://example.test/two.jpg');
  await page.locator('#project-image-alt-1').fill('Baustelle');
  await page.getByRole('tab', { name: /Einstellungen|projects\.tabs\.settings/ }).click();
  await page.locator('#project-status').selectOption('published');
  await page.locator('#project-author-id').fill('org-1');
  await page.locator('#project-author-name').fill('Stadt Musterhausen');
  await page.getByRole('button', { name: /Projekt anlegen|projects\.actions\.create/ }).last().click();
  await expect.poll(() => project?.published).toBe(true);

  await navigateClientSide(page, '/admin/projects/project-1');
  await expect(page.locator('#project-title')).toHaveValue('Neue Brücke');
  await page.getByRole('tab', { name: /Inhalt|projects\.tabs\.content/ }).click();
  await page.getByRole('button', { name: /Bild nach oben|projects\.actions\.moveImageUp/ }).nth(1).click();
  await page.getByRole('button', { name: /Projekt speichern|projects\.actions\.update/ }).last().click();
  await expect.poll(() => (project?.images as Array<{ altText: string }> | undefined)?.[0]?.altText).toBe('Baustelle');
  await page.getByRole('button', { name: /Projekt löschen|projects\.actions\.delete/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: /Projekt löschen|projects\.actions\.delete/ }).click();
  await expect.poll(() => deleted).toBe(true);
});
