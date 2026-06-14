import { describe, expect, it } from 'vitest';

import { profileAccountDEResources } from './resources/de/account/profile.resources.js';
import { profileAccountENResources } from './resources/en/account/profile.resources.js';
import { instancesAdminDEResources } from './resources/de/admin/instances.resources.js';
import { instancesAdminENResources } from './resources/en/admin/instances.resources.js';
import { deResources } from './resources/de.js';
import { enResources } from './resources/en.js';
import { accountDEResources } from './resources/de/account.resources.js';
import { accountENResources } from './resources/en/account.resources.js';
import { adminDEResources } from './resources/de/admin.resources.js';
import { adminENResources } from './resources/en/admin.resources.js';
import { pageInstancesAdminDEResources } from './resources/de/admin/instances/page.resources.js';
import { pageInstancesAdminENResources } from './resources/en/admin/instances/page.resources.js';
import { shellDEResources } from './resources/de/shell.resources.js';
import { shellENResources } from './resources/en/shell.resources.js';

describe('i18n resource structure', () => {
  it('exports locale feature resources from explicit resource filenames', () => {
    expect(deResources.shell).toBe(shellDEResources);
    expect(enResources.shell).toBe(shellENResources);
    expect(shellDEResources.appName).toBe('SVA Studio');
    expect(shellENResources.appName).toBe('SVA Studio');
  });

  it('exports admin subresources from explicit admin resource filenames', () => {
    expect(adminDEResources.instances).toBe(instancesAdminDEResources);
    expect(adminENResources.instances).toBe(instancesAdminENResources);
    expect(instancesAdminDEResources.page.title).toBe('Instanzverwaltung');
    expect(instancesAdminENResources.page.title).toBe('Instance Management');
  });

  it('exports nested admin instances and account subresources from explicit filenames', () => {
    expect(instancesAdminDEResources.page).toBe(pageInstancesAdminDEResources);
    expect(instancesAdminENResources.page).toBe(pageInstancesAdminENResources);
    expect(accountDEResources.profile).toBe(profileAccountDEResources);
    expect(accountENResources.profile).toBe(profileAccountENResources);
  });
});
