import { describe, expect, it } from 'vitest';

import { renderStudioInstanceAuditHtml } from './render-html.ts';

describe('renderStudioInstanceAuditHtml', () => {
  it('renders status summary and instance details', () => {
    const html = renderStudioInstanceAuditHtml({
      generatedAt: '2026-06-10T12:00:00.000Z',
      instances: [
        {
          authClientId: 'sva-studio',
          authRealm: 'bb-guben',
          checks: [
            {
              checkId: 'reachability.root',
              status: 'pass',
              summary: 'GET / -> 200',
              title: 'Tenant root URL antwortet',
            },
          ],
          instanceId: 'bb-guben',
          parentDomain: 'studio.smart-village.app',
          primaryHostname: 'bb-guben.studio.smart-village.app',
          registryStatus: 'active',
          status: 'warn',
        },
      ],
      profile: 'studio',
      status: 'warn',
    });

    expect(html).toContain('Studio Instanz-Audit');
    expect(html).toContain('bb-guben');
    expect(html).toContain('reachability.root');
  });
});
