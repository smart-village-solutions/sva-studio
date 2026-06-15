import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { wasteManagementHolidayRuleHandlers } from './holiday-rules.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createHeaders = () => ({
  'content-type': 'application/json',
  origin: 'https://studio.test',
  'x-requested-with': 'XMLHttpRequest',
});

const createDeps = () => ({
  getRequestId: () => 'req-test',
  getSessionById: vi.fn(async () => ({ activeOrganizationId: 'org-1' })),
  emitAuditEvent: vi.fn(async () => undefined),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action: 'waste-management.scheduling.manage',
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
});

describe('waste-management holiday rule handlers', () => {
  it('updates holiday rules by merging scope and strategy into the persisted record', async () => {
    const loadedRule = {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed' as const,
      configurationStatus: 'draft' as const,
      conflictStatus: 'none' as const,
      scope: undefined,
      strategy: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const loadWasteHolidayRuleById = vi
      .fn(async () => loadedRule)
      .mockResolvedValueOnce(loadedRule)
      .mockResolvedValueOnce({
        ...loadedRule,
        scope: 'holiday-only',
        strategy: 'advance',
        configurationStatus: 'configured',
      });
    const saveWasteHolidayRule = vi.fn(async () => undefined);

    const response = await wasteManagementHolidayRuleHandlers.updateWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({
          scope: 'holiday-only',
          strategy: 'advance',
        }),
      }),
      actor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById,
        saveWasteHolidayRule,
      }
    );

    expect(response.status).toBe(200);
    expect(saveWasteHolidayRule).toHaveBeenCalledWith('tenant-a', {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'configured',
      conflictStatus: 'none',
      scope: 'holiday-only',
      strategy: 'advance',
    });
  });

  it('returns invalid_request when the holidayRuleId path segment is missing', async () => {
    const response = await wasteManagementHolidayRuleHandlers.updateWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({
          scope: 'holiday-only',
          strategy: 'advance',
        }),
      }),
      actor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById: vi.fn(async () => null),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'holidayRuleId fehlt im Pfad.',
      },
      requestId: 'req-test',
    });
  });

  it('short-circuits update and delete on auth, instance, csrf, and invalid-payload guard failures', async () => {
    const authDenied = await wasteManagementHolidayRuleHandlers.updateWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({
          scope: 'holiday-only',
          strategy: 'advance',
        }),
      }),
      actor,
      {
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [],
        })),
      }
    );
    expect(authDenied.status).toBe(403);

    const missingInstanceActor: AuthenticatedRequestContext = {
      sessionId: 'session-1',
      user: {
        ...actor.user,
        instanceId: undefined,
      },
    };
    const deleteMissingInstance = await wasteManagementHolidayRuleHandlers.deleteWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      missingInstanceActor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById: vi.fn(async () => ({ id: 'holiday-rule-1' })),
        deleteWasteHolidayRule: vi.fn(async () => undefined),
      }
    );
    expect(deleteMissingInstance.status).toBe(400);

    const updateMissingCsrf = await wasteManagementHolidayRuleHandlers.updateWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'holiday-only',
          strategy: 'advance',
        }),
      }),
      actor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById: vi.fn(async () => ({ id: 'holiday-rule-1' })),
        saveWasteHolidayRule: vi.fn(async () => undefined),
      }
    );
    expect(updateMissingCsrf.status).toBe(403);

    const updateInvalidPayload = await wasteManagementHolidayRuleHandlers.updateWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({
          strategy: 'invalid-strategy',
        }),
      }),
      actor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById: vi.fn(async () => ({ id: 'holiday-rule-1' })),
        saveWasteHolidayRule: vi.fn(async () => undefined),
      }
    );
    expect(updateInvalidPayload.status).toBe(400);

    const deleteMissingPath = await wasteManagementHolidayRuleHandlers.deleteWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById: vi.fn(async () => ({ id: 'holiday-rule-1' })),
        deleteWasteHolidayRule: vi.fn(async () => undefined),
      }
    );
    expect(deleteMissingPath.status).toBe(400);

    const deleteMissingCsrf = await wasteManagementHolidayRuleHandlers.deleteWasteManagementHolidayRuleInternal(
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'DELETE',
      }),
      actor,
      {
        ...createDeps(),
        loadWasteHolidayRuleById: vi.fn(async () => ({ id: 'holiday-rule-1' })),
        deleteWasteHolidayRule: vi.fn(async () => undefined),
      }
    );
    expect(deleteMissingCsrf.status).toBe(403);
  });
});
