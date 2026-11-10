import { IconActivity } from '@tabler/icons-react';
import { describe, expect, it, vi } from 'vitest';
import { buildSidebarSystemItems } from './sidebar-system-items';
import type { SidebarAccess } from './sidebar-access';
import type { SidebarLeafItem } from './sidebar-model';

vi.mock('../i18n', () => ({ t: (key: string) => key }));
const emailItem: SidebarLeafItem = {
  kind: 'link',
  id: 'plugin-waste-management.email-monitoring.navigation',
  to: '/plugins/waste-management/email-monitoring',
  label: 'Email',
  icon: IconActivity,
};
const access = (canAccessSystemTools = false) => ({ canAccessSystemTools }) as SidebarAccess;

describe('plugin email monitoring navigation', () => {
  it('places the authorized plugin entry under Monitoring without requiring general monitoring access', () => {
    const items = buildSidebarSystemItems(access(), [emailItem]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'group', id: 'monitoring', children: [emailItem] });
  });
  it('keeps the overview alongside the plugin entry for general monitoring readers', () => {
    expect(buildSidebarSystemItems(access(true), [emailItem])[0]).toMatchObject({
      kind: 'group',
      children: [{ to: '/monitoring' }, emailItem],
    });
  });
  it('does not introduce a plugin entry when the permission-filtered navigation omits it', () => {
    expect(buildSidebarSystemItems(access(), [])).toEqual([]);
    expect(buildSidebarSystemItems(access(true), [])).toEqual([
      expect.objectContaining({ kind: 'link', id: 'monitoring', to: '/monitoring' }),
    ]);
  });
});
