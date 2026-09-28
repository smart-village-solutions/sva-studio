import { describe, expect, it, vi } from 'vitest';

describe('Waste host control boundary', () => {
  it('fails closed when no host authorization is bound', async () => {
    const { authorizeWasteManagementAction } = await vi.importActual<typeof import('../src/handlers/auth.js')>(
      '../src/handlers/auth.js'
    );
    await expect(authorizeWasteManagementAction(
      { sessionId: 'session-1', user: { id: 'user-1', instanceId: 'tenant-a', roles: [] } },
      'waste-management.tours.manage',
      {},
      'req-1'
    )).rejects.toThrow('missing_dependency:authorizeAction');
  }, 15_000);

  it('fails closed when no host CSRF guard is bound', async () => {
    const { validateCsrf } = await vi.importActual<typeof import('../src/handlers/host-controls.js')>(
      '../src/handlers/host-controls.js'
    );
    expect(() => validateCsrf({}, new Request('https://studio.test/api/v1/waste-management/tours'), 'req-1'))
      .toThrow('missing_dependency:validateCsrf');
  });
});
