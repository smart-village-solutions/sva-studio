import { isValidInstanceId, type ExternalInterfaceRecord } from '@sva/core';
import {
  loadDefaultExternalInterfaceRecord,
  saveMainserverTranslationServiceBinding,
} from '@sva/data-repositories/server';
import { z } from 'zod';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';
import { withIamAppDb } from './db.js';
import { normalizePublicUpstreamUrl } from './upstream-url-validation.js';

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

const readActiveScope = (connection: ExternalInterfaceRecord, context: StudioJobExecutionHandlerContext) =>
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

const readIdentity = async (url: string) => {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok || !response.body) throw new Error('mainserver_identity_unavailable');
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
  return identitySchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)));
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
    const identity = await readIdentity(url);
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
