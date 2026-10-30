import { isValidInstanceId, type ExternalInterfaceRecord } from '@sva/core';
import {
  loadDefaultExternalInterfaceRecord,
  saveMainserverTranslationServiceBinding,
} from '@sva/data-repositories/server';
import { z } from 'zod';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';
import { withIamAppDb } from './db.js';
import { normalizePublicUpstreamUrl } from './upstream-url-validation.js';
import { readEffectiveSvaMainserverCredentialsWithStatus } from './mainserver-effective-credentials.js';

const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
});
export const translationServiceBindingSchema = z
  .object({
    issuer: httpsUrl,
    audience: z.string().min(1).max(256),
    clientId: z.string().min(1).max(256),
    subject: z.string().min(1).max(256),
  })
  .strict();
const identitySchema = z
  .object({
    schemaVersion: z.literal(1),
    instanceId: z.string().refine(isValidInstanceId),
    studioUrl: httpsUrl,
    binding: translationServiceBindingSchema.extend({
      audience: z.literal('sva-studio-app-translations'),
    }),
  })
  .strict();

const readActiveScope = (
  connection: ExternalInterfaceRecord,
  context: StudioJobExecutionHandlerContext
) =>
  withIamAppDb(async (client) => {
    await client.query("SELECT set_config('app.instance_id', $1, true)", [connection.instanceId]);
    const result = await client.query<{
      primary_hostname: string;
      generation: string;
      assignment_revision: string;
    }>(
      `SELECT i.primary_hostname, l.desired_generation::text AS generation, e.xmin::text AS assignment_revision
     FROM iam.instances i
     JOIN iam.instance_modules m ON m.instance_id=i.id AND m.module_id='app-translations'
     JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id
     JOIN iam.instance_external_interfaces e ON e.instance_id=i.id AND e.id=$2
     WHERE i.id=$1 AND i.status='active' AND m.effective_active
       AND (l.access_state='active' OR ($6='reactivate' AND l.access_state='suspended'))
       AND l.desired_generation=$4::bigint AND l.active_job_id=$5::uuid AND l.claimed_generation=l.desired_generation AND l.desired_operation=$6
       AND e.enabled AND e.is_default AND e.public_config_json=$3::jsonb`,
      [
        connection.instanceId,
        connection.id,
        JSON.stringify(connection.publicConfig),
        context.tenantLifecycle?.generation,
        context.job.id,
        context.tenantLifecycle?.operation,
      ]
    );
    return result.rows.length === 1 ? result.rows[0] : undefined;
  });

export const readAppTranslationServiceBinding = async (instanceId: string): Promise<boolean> => {
  const connection = await loadDefaultExternalInterfaceRecord(instanceId, 'sva_mainserver');
  return (
    !!connection?.enabled &&
    translationServiceBindingSchema.safeParse(connection.publicConfig.translationService).success
  );
};

const readBoundedJson = async (response: Response): Promise<unknown> => {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('mainserver_identity_unavailable');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw new Error('mainserver_identity_invalid');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
};

const readSetupOrganization = (connection: ExternalInterfaceRecord, attempted: readonly string[]) =>
  withIamAppDb(async (client) => {
    await client.query("SELECT set_config('app.instance_id', $1, true)", [connection.instanceId]);
    const result = await client.query<{ organization_id: string }>(
      `SELECT c.organization_id FROM iam.organization_mainserver_credentials c
       JOIN iam.organizations o ON o.instance_id=c.instance_id AND o.id=c.organization_id
       JOIN iam.accounts a ON a.instance_id=c.instance_id AND a.id=c.technical_account_id
       WHERE c.instance_id=$1 AND NOT (c.organization_id = ANY($2::uuid[]))
         AND c.provisioning_status='ready' AND o.is_active
         AND nullif(trim(c.mainserver_application_id),'') IS NOT NULL
         AND nullif(trim(c.mainserver_application_secret_ciphertext),'') IS NOT NULL
         AND a.is_technical_account AND a.status='active' AND NOT a.is_blocked
         AND a.soft_deleted_at IS NULL AND a.permanently_deleted_at IS NULL AND a.deactivated_at IS NULL
       ORDER BY o.id LIMIT 1`,
      [connection.instanceId, attempted]
    );
    return result.rows[0]?.organization_id;
  });

const requestServiceSetup = async (
  connection: ExternalInterfaceRecord,
  context: StudioJobExecutionHandlerContext,
  url: string,
  studioUrl: string
): Promise<Response> => {
  if (typeof connection.publicConfig.oauthTokenUrl !== 'string')
    throw new Error('mainserver_setup_credentials_missing');
  const tokenUrl = await normalizePublicUpstreamUrl(connection.publicConfig.oauthTokenUrl);
  if (!tokenUrl) throw new Error('mainserver_setup_credentials_missing');
  const signal = context.abortSignal
    ? AbortSignal.any([context.abortSignal, AbortSignal.timeout(35000)])
    : AbortSignal.timeout(35000);
  const attempted: string[] = [];
  while (true) {
    signal.throwIfAborted();
    const organizationId = await readSetupOrganization(connection, attempted);
    if (!organizationId) throw new Error('mainserver_setup_credentials_missing');
    const credentials = await readEffectiveSvaMainserverCredentialsWithStatus({
      instanceId: connection.instanceId,
      keycloakSubject: '',
      activeOrganizationId: organizationId,
      actingPrincipalType: 'organization',
    });
    if (credentials.status !== 'ok' || credentials.source !== 'organization')
      throw new Error('mainserver_setup_credentials_missing');
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.credentials.apiKey,
        client_secret: credentials.credentials.apiSecret,
      }),
    });
    const token = z
      .object({
        access_token: z
          .string()
          .min(1)
          .max(4096)
          .regex(/^[A-Za-z0-9._~+/-]+=*$/),
      })
      .parse(await readBoundedJson(tokenResponse));
    // A queued activation may have been superseded while requesting the token.
    const currentScope = await readActiveScope(connection, context);
    if (!currentScope || currentScope.primary_hostname !== new URL(studioUrl).host)
      throw new Error('mainserver_setup_scope_changed');
    if ((await readSetupOrganization(connection, attempted)) !== organizationId)
      throw new Error('mainserver_setup_scope_changed');
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify({ instanceId: connection.instanceId, studioUrl }),
    });
    // Only a definitive permission denial permits trying another existing identity.
    if (response.status !== 403) return response;
    await response.body?.cancel();
    attempted.push(organizationId);
  }
};

/** Only the root-managed upstream is trusted; incoming requests never enroll identities. */
export const reconcileAppTranslationServiceBinding = async (
  context: StudioJobExecutionHandlerContext
): Promise<boolean> => {
  const instanceId = context.job.instanceId;
  const lifecycle = context.tenantLifecycle;
  if (
    !instanceId ||
    !lifecycle ||
    !['provision', 'reconcile', 'reactivate'].includes(lifecycle.operation)
  )
    return false;
  try {
    const connection = await loadDefaultExternalInterfaceRecord(instanceId, 'sva_mainserver');
    if (!connection?.enabled || typeof connection.publicConfig.graphqlBaseUrl !== 'string')
      return false;
    const scope = await readActiveScope(connection, context);
    if (!scope) return false;
    const url = await normalizePublicUpstreamUrl(
      new URL(
        '/api/v1/app_translations/service_identity',
        connection.publicConfig.graphqlBaseUrl
      ).toString()
    );
    if (!url) return false;
    let response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (
      [404, 503].includes(response.status) &&
      connection.publicConfig.translationService === undefined
    ) {
      await response.body?.cancel();
      response = await requestServiceSetup(
        connection,
        context,
        url,
        `https://${scope.primary_hostname}/api/v1/app-translations/translate`
      );
    }
    const identity = identitySchema.parse(await readBoundedJson(response));
    const destinations = [`https://${scope.primary_hostname}/api/v1/app-translations/translate`];
    const publicBase = httpsUrl.safeParse(process.env.SVA_PUBLIC_BASE_URL);
    if (publicBase.success)
      destinations.push(new URL('/api/v1/app-translations/translate', publicBase.data).toString());
    if (identity.instanceId !== instanceId || !destinations.includes(identity.studioUrl))
      return false;
    if (!(await normalizePublicUpstreamUrl(identity.binding.issuer))) return false;
    const existing = connection.publicConfig.translationService;
    if (existing !== undefined) {
      const parsed = translationServiceBindingSchema.safeParse(existing);
      if (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(identity.binding))
        return false;
    }
    return await saveMainserverTranslationServiceBinding({
      connection,
      binding: identity.binding,
      generation: scope.generation,
      jobId: context.job.id,
      operation: lifecycle.operation,
      assignmentRevision: scope.assignment_revision,
      hostname: scope.primary_hostname,
    });
  } catch {
    return false;
  }
};
