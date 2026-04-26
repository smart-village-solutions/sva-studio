import { createSdkLogger } from '@sva/server-runtime';
import {
  consumeLegalConsentExportRateLimit,
  hasLegalConsentExportPermission,
  loadConsentExportRecords,
} from '@sva/iam-governance';

import { readPathSegment } from '../iam-account-management/api-helpers.js';
import {
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import { withAuthenticatedUser } from '../middleware.server.js';

const logger = createSdkLogger({ component: 'iam-legal-consent-export', level: 'info' });

export const legalConsentExportHandler = async (request: Request): Promise<Response> => {
  return withAuthenticatedUser(request, async (ctx) => {
    const instanceId = readPathSegment(request, 3);
    if (!instanceId) {
      return new Response(JSON.stringify({ error: { code: 'invalid_instance_id' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!hasLegalConsentExportPermission(ctx.user.roles)) {
      return new Response(JSON.stringify({ error: { code: 'forbidden' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rateLimit = consumeLegalConsentExportRateLimit({
      instanceId,
      actorKeycloakSubject: ctx.user.id,
    });
    if (rateLimit) {
      return new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId') ?? undefined;

    try {
      const records = await withInstanceScopedDb(instanceId, (client) =>
        loadConsentExportRecords(instanceId, accountId, client)
      );

      logger.info('Legal consent export completed', {
        operation: 'legal_consent_export',
        instance_id: instanceId,
        account_id: accountId ?? 'all',
        record_count: records.length,
      });

      return new Response(JSON.stringify({ data: records, count: records.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Legal consent export failed', {
        operation: 'legal_consent_export',
        instance_id: instanceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return new Response(JSON.stringify({ error: { code: 'export_failed' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
};
