import { describe, expect, it } from 'vitest';

import {
  buildGovernanceComplianceExport,
  serializeGovernanceComplianceCsv,
  toGovernanceComplianceExportRows,
} from './governance-compliance-export.js';
import type { QueryClient } from './query-client.js';

describe('governance-compliance-export', () => {
  it('maps activity log payloads to governance export rows with fallbacks', () => {
    const rows = toGovernanceComplianceExportRows([
      {
        id: 'log-1',
        event_type: 'governance_permission_change_submitted',
        payload: {
          action: 'permission_change_submit',
          result: 'success',
          actor_pseudonym: 'actor-1',
        },
        request_id: 'req-1',
        trace_id: 'trace-1',
        created_at: '2026-02-28T12:00:00.000Z',
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        event_id: 'log-1',
        timestamp: '2026-02-28T12:00:00.000Z',
        action: 'permission_change_submit',
        result: 'success',
        actor_pseudonym: 'actor-1',
        request_id: 'req-1',
        trace_id: 'trace-1',
        event_type: 'governance_permission_change_submitted',
      }),
    ]);
  });

  it('serializes csv fields with comma, quote and newline escaping', () => {
    const csv = serializeGovernanceComplianceCsv([
      {
        event_id: 'evt-1',
        timestamp: '2026-02-28T12:00:00.000Z',
        instance_id: 'de-musterhausen',
        action: 'permission,change',
        result: 'success',
        actor_pseudonym: 'actor "one"',
        target_ref: 'line\nbreak',
        reason_code: undefined,
        request_id: 'req-1',
        trace_id: 'trace-1',
        event_type: 'governance_permission_change_submitted',
      },
    ]);

    expect(csv).toContain('"permission,change"');
    expect(csv).toContain('"actor ""one"""');
    expect(csv).toContain('"line\nbreak"');
  });

  it('loads rows and emits siem format when requested', async () => {
    const client: QueryClient = {
      async query(_sql, params) {
        expect(params).toEqual(['de-musterhausen', '2026-02-01', '2026-02-28']);
        return {
          rowCount: 1,
          rows: [
            {
              id: 'log-1',
              event_type: 'governance_impersonation_started',
              payload: {
                event_id: 'evt-1',
                timestamp: '2026-02-28T12:00:00.000Z',
                action: 'impersonation_start',
                result: 'success',
              },
              request_id: null,
              trace_id: null,
              created_at: '2026-02-28T12:00:00.000Z',
            },
          ],
        };
      },
    };

    const result = await buildGovernanceComplianceExport(client, {
      instanceId: 'de-musterhausen',
      from: '2026-02-01',
      to: '2026-02-28',
      format: 'siem',
    });

    expect(result).toEqual({
      format: 'siem',
      body: {
        format: 'siem',
        rows: [
          expect.objectContaining({
            '@timestamp': '2026-02-28T12:00:00.000Z',
            event_id: 'evt-1',
            action: 'impersonation_start',
            event_type: 'governance_impersonation_started',
          }),
        ],
      },
    });
  });
});
