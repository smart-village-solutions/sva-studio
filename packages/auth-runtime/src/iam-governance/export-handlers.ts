import { withRequestContext } from '@sva/server-runtime';
import { consumeLegalConsentExportRateLimit, loadConsentExportRecords } from '@sva/iam-governance';
import { buildGovernanceComplianceExport } from '@sva/iam-governance/governance-compliance-export';

import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { isUuid, readString } from '../shared/input-readers.js';
import {
  GOVERNANCE_EXPORT_ACTION,
  authorizeGovernanceAction,
  buildGovernanceLogContext,
  logger,
  withInstanceScopedDb,
} from './handler-support.js';

const escapeCsvField = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};

const serializeLegalConsentExportCsv = (
  rows: readonly {
    id: string;
    workspaceId?: string;
    subjectId: string;
    legalTextId: string;
    legalTextVersion: string;
    actionType: string;
    acceptedAt: string;
    revokedAt?: string;
    targets: { roleIds: readonly string[]; groupIds: readonly string[] };
  }[]
): string => {
  const header = [
    'id',
    'workspaceId',
    'subjectId',
    'legalTextId',
    'legalTextVersion',
    'actionType',
    'acceptedAt',
    'revokedAt',
    'roleTargetIds',
    'groupTargetIds',
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.workspaceId ?? '',
      row.subjectId,
      row.legalTextId,
      row.legalTextVersion,
      row.actionType,
      row.acceptedAt,
      row.revokedAt ?? '',
      row.targets.roleIds.join('|'),
      row.targets.groupIds.join('|'),
    ]
      .map((field) => escapeCsvField(field))
      .join(',')
  );

  return [header.join(','), ...lines].join('\n');
};

export const governanceComplianceExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const { user } = ctx;
      const authorizationError = await authorizeGovernanceAction(
        ctx,
        GOVERNANCE_EXPORT_ACTION,
        'Keine Berechtigung für Governance-Exporte.'
      );
      if (authorizationError) {
        logger.warn('Governance compliance export denied due to missing permission', {
          operation: 'compliance_export',
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return authorizationError;
      }

      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const format = (readString(url.searchParams.get('format')) ?? 'json').toLowerCase();
      const from = readString(url.searchParams.get('from'));
      const to = readString(url.searchParams.get('to'));

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        const exportResult = await withInstanceScopedDb(instanceId, async (client) =>
          buildGovernanceComplianceExport(client, { instanceId, format, from, to })
        );

        if (exportResult.format === 'csv') {
          return new Response(exportResult.body, {
            status: 200,
            headers: {
              'Content-Type': exportResult.contentType,
            },
          });
        }

        return jsonResponse(200, exportResult.body);
      } catch (error) {
        logger.error('Governance compliance export failed', {
          operation: 'compliance_export',
          error: error instanceof Error ? error.message : String(error),
          format,
          ...buildGovernanceLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const legalConsentExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const { user } = ctx;
      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const accountId = readString(url.searchParams.get('accountId')) ?? undefined;
      const format = (readString(url.searchParams.get('format')) ?? 'json').toLowerCase();

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }
      if (format !== 'json' && format !== 'csv') {
        return jsonResponse(400, { error: 'invalid_request' });
      }
      if (accountId && !isUuid(accountId)) {
        return jsonResponse(400, { error: 'invalid_request' });
      }
      const authorizationError = await authorizeGovernanceAction(
        ctx,
        GOVERNANCE_EXPORT_ACTION,
        'Keine Berechtigung für Consent-Exporte.'
      );
      if (authorizationError) {
        logger.warn('Legal consent export denied due to missing permission', {
          operation: 'legal_consent_export',
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return authorizationError;
      }

      const rateLimit = consumeLegalConsentExportRateLimit({
        instanceId,
        actorKeycloakSubject: user.id,
      });
      if (rateLimit) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        });
      }

      try {
        const rows = await withInstanceScopedDb(instanceId, (client) =>
          loadConsentExportRecords(instanceId, accountId, client)
        );
        if (format === 'csv') {
          return new Response(serializeLegalConsentExportCsv(rows), {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
            },
          });
        }
        return jsonResponse(200, { format, rows });
      } catch (error) {
        logger.error('Legal consent export failed', {
          operation: 'legal_consent_export',
          error: error instanceof Error ? error.message : String(error),
          format,
          ...buildGovernanceLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};
