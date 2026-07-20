import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { UpstreamSchemaError, type StudioApiClient, type StudioApiRequest } from './api-client.js';
import type { StudioMcpConfig } from './config.js';
import { schemas } from './contracts.js';
import { diagnoseInstance } from './diagnostics.js';
import { normalizeError } from './errors.js';

type ToolResult = {
  content: [{ type: 'text'; text: string }];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

const result = (payload: Record<string, unknown>, isError = false): ToolResult => ({
  content: [{ type: 'text', text: isError || payload.ok === false
    ? 'Studio-Operation fehlgeschlagen. Details stehen im Fehlervertrag.'
    : 'Studio-Operation erfolgreich.' }],
  structuredContent: payload,
  ...(isError ? { isError: true } : {}),
});

const without = <T extends Record<string, unknown>>(value: T, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

const call = async (
  client: StudioApiClient,
  request: StudioApiRequest,
  diagnosis?: { instanceId: string; timeoutMs: number }
): Promise<ToolResult> => {
  const requestId = request.requestId ?? randomUUID();
  const correlatedRequest = { ...request, requestId };
  try {
    const data = await client.request(correlatedRequest);
    return result({ ok: true, data, meta: { requestId, ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}) } });
  } catch (caught) {
    if (caught instanceof UpstreamSchemaError) throw caught;
    const error = normalizeError(caught);
    const diagnostics = diagnosis
      ? await diagnoseInstance(client, diagnosis.instanceId, diagnosis.timeoutMs, error).catch(() => undefined)
      : undefined;
    return result({ ok: false, error, ...(diagnostics ? { diagnostics } : {}), meta: { requestId: error.requestId } });
  }
};

const mutation = (
  path: string,
  params: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST',
  includeInstanceId = false
): StudioApiRequest => {
  const requestId = randomUUID();
  const idempotency = typeof params.idempotencyKey === 'string' ? params.idempotencyKey : randomUUID();
  return {
    method, path,
    body: without(params, [
      ...(includeInstanceId ? [] : ['instanceId']),
      'idempotencyKey',
      'challengeId',
      'confirmationPhrase',
    ]),
    requestId,
    idempotencyKey: idempotency,
    ...(typeof params.challengeId === 'string' ? { confirmationChallengeId: params.challengeId } : {}),
    ...(typeof params.confirmationPhrase === 'string' ? { confirmationPhrase: params.confirmationPhrase } : {}),
  };
};

const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const nonIdempotentWriteAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
const criticalAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;
const outputShape = {
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.unknown().optional(),
  diagnostics: z.unknown().optional(),
  meta: z.record(z.string(), z.unknown()),
};

export const registerStudioTools = (server: McpServer, client: StudioApiClient, config: StudioMcpConfig): void => {
  const register = <S extends z.ZodObject<z.ZodRawShape>>(
    name: string, title: string, description: string, schema: S,
    annotations: typeof readAnnotations | typeof writeAnnotations | typeof nonIdempotentWriteAnnotations | typeof criticalAnnotations,
    handler: (params: z.infer<S>) => Promise<ToolResult>
  ) => server.registerTool(
    name,
    { title, description, inputSchema: schema.shape, outputSchema: outputShape, annotations },
    async (params) => handler(schema.parse(params))
  );

  register('studio_instances_list', 'Studio-Instanzen auflisten', 'Listet Studio-Instanzen read-only nach Suche und Status.', schemas.list, readAnnotations,
    (p) => call(client, { path: '/api/v1/iam/instances', query: p }));
  register('studio_instance_get', 'Studio-Instanz lesen', 'Liest den vollständigen aktuellen Zustand einer Instanz.', schemas.instance, readAnnotations,
    (p) => call(client, { path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}` }));
  register('studio_instance_audit', 'Instanz-Audit lesen', 'Liest den Audit-Lauf einer Instanz.', schemas.instance, readAnnotations,
    (p) => call(client, { path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/audit` }));
  register('studio_instances_audit', 'Instanzbestand auditieren', 'Führt den read-only Audit für ausgewählte oder aktive Instanzen aus.', schemas.auditAll, readAnnotations,
    (p) => call(client, { path: '/api/v1/iam/instances/audit', query: { instanceId: p.instanceIds, includeOnlyActive: p.includeOnlyActive } }));
  register('studio_instance_diagnose', 'Studio-Instanz diagnostizieren', 'Aggregiert Detail-, Keycloak-Preflight- und Status-Evidenz ohne Änderungen.', schemas.diagnose, readAnnotations,
    async (p) => result({ ok: true, data: await diagnoseInstance(client, p.instanceId, config.diagnosisTimeoutMs), meta: {} }));
  register('studio_instance_provisioning_run_get', 'Provisioning-Lauf lesen', 'Liest einen bestimmten Keycloak-Provisioning-Lauf.', schemas.run, readAnnotations,
    (p) => call(client, { path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/runs/${encodeURIComponent(p.runId)}` }));

  register('studio_instances_create', 'Studio-Instanz erstellen', 'Erstellt idempotent eine Registry-Instanz; Provisionierung und Aktivierung bleiben getrennt.', schemas.create, writeAnnotations,
    (p) => call(client, mutation('/api/v1/iam/instances', p, 'POST', true), { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }));
  register('studio_instance_update', 'Studio-Instanz aktualisieren', 'Aktualisiert die Konfiguration einer vorhandenen Instanz idempotent.', schemas.update, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}`, p, 'PATCH'), { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }));
  register('studio_instance_provisioning_plan', 'Provisionierung planen', 'Erzeugt den serverseitigen Keycloak-Provisioning-Plan ohne ihn auszuführen.', schemas.plan, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/plan`, p)));
  register('studio_instance_provisioning_execute', 'Provisionierung ausführen', 'Startet eine zuvor geprüfte Keycloak-Provisionierung asynchron.', schemas.execute, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/execute`, p), { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }));
  register('studio_instance_reconcile', 'Instanz abgleichen', 'Gleicht die Keycloak-Artefakte kontrolliert ab; Secret-Rotation ist ausgeschlossen.', schemas.reconcile, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/reconcile`, p), { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }));
  register('studio_instance_module_assign', 'Modul zuweisen', 'Weist einer Instanz idempotent ein Modul zu.', schemas.assignModule, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/assign`, p)));
  register('studio_instance_iam_baseline_seed', 'IAM-Baseline seeden', 'Seedet die IAM-Baseline der zugewiesenen Module.', schemas.seed, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/seed-iam-baseline`, p)));
  register('studio_instance_admin_bootstrap', 'Admin-Struktur bootstrappen', 'Erzeugt die Admin-Struktur für ausgewählte Module.', schemas.bootstrap, writeAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/bootstrap-admin-structure`, p)));
  register('studio_instance_critical_action_prepare', 'Kritische Aktion vorbereiten', 'Erzeugt eine kurzlebige, zustandsgebundene Bestätigungs-Challenge; führt die Aktion nicht aus.', schemas.prepareCritical, nonIdempotentWriteAnnotations,
    (p) => call(client, {
      method: 'POST',
      path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/actions/${encodeURIComponent(p.actionId)}/confirmation`,
      query: { moduleId: p.moduleId },
      body: {},
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
    }));

  const critical = (name: string, title: string, action: string, path: (p: { instanceId: string }) => string, body?: Record<string, unknown>) =>
    register(name, title, `Kritische Aktion ${action}; verlangt eine gültige serverseitige Challenge und exakte Bestätigungsphrase.`, schemas.critical, criticalAnnotations,
      (p) => call(client, mutation(path(p), { ...body, challengeId: p.challengeId, confirmationPhrase: p.confirmationPhrase, idempotencyKey: p.idempotencyKey })));
  critical('studio_instance_activate', 'Instanz aktivieren', 'instance.status.activate', (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/activate`, { status: 'active' });
  critical('studio_instance_suspend', 'Instanz suspendieren', 'instance.status.suspend', (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/suspend`, { status: 'suspended' });
  critical('studio_instance_archive', 'Instanz archivieren', 'instance.status.archive', (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/archive`, { status: 'archived' });
  register('studio_instance_module_revoke', 'Modul entziehen', 'Entzieht ein Modul nach serverseitiger Challenge und exakter Phrase.', schemas.revoke, criticalAnnotations,
    (p) => call(client, mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/revoke`, { ...p, confirmation: 'REVOKE' })));
  critical('studio_instance_secret_rotate', 'Client-Secret rotieren', 'instance.secret.rotate', (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/rotate-secret`, { intent: 'rotate_client_secret' });
};
