import type { StudioApiClient } from './api-client.js';
import type { StudioMcpConfig } from './config.js';
import { schemas } from './contracts.js';
import { diagnoseInstance } from './diagnostics.js';
import { call, readAnnotations, result, type ToolRegistrar } from './tools-support.js';

const registerCatalogTools = (register: ToolRegistrar, client: StudioApiClient): void => {
  register(
    'studio_instances_list',
    'Studio-Instanzen auflisten',
    'Listet Studio-Instanzen read-only nach Suche und Status.',
    schemas.list,
    readAnnotations,
    (p) => call(client, { path: '/api/v1/iam/instances', query: p })
  );
  register(
    'studio_keycloak_realms_list',
    'Keycloak-Realms auflisten',
    'Listet auswählbare und begründet gesperrte Keycloak-Realms read-only.',
    schemas.realmCatalog,
    readAnnotations,
    (p) =>
      call(client, {
        path: '/api/v1/iam/instances/keycloak-realms',
        query: {
          search: p.search,
          page: p.page === undefined ? undefined : String(p.page),
          pageSize: p.pageSize === undefined ? undefined : String(p.pageSize),
        },
      })
  );
  register(
    'studio_instance_draft_readiness',
    'Instanzentwurf prüfen',
    'Prüft einen noch nicht gespeicherten Instanzentwurf ohne Mutation. tenantAdminBootstrap.adoptExisting kann ausschließlich im vorhandenen Realm einen exakt passenden, unmarkierten Bestands-Admin zur Übernahme freigeben.',
    schemas.draftReadiness,
    readAnnotations,
    (p) => call(client, { method: 'POST', path: '/api/v1/iam/instances/draft-readiness', body: p })
  );
  register(
    'studio_instance_get',
    'Studio-Instanz lesen',
    'Liest den vollständigen aktuellen Zustand einer Instanz.',
    schemas.instance,
    readAnnotations,
    (p) => call(client, { path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}` })
  );
  register(
    'studio_instance_audit',
    'Instanz-Audit lesen',
    'Liest den Audit-Lauf einer Instanz.',
    schemas.instance,
    readAnnotations,
    (p) => call(client, { path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/audit` })
  );
};

const registerInstanceReadTools = (
  register: ToolRegistrar,
  client: StudioApiClient,
  config: StudioMcpConfig
): void => {
  register(
    'studio_instances_audit',
    'Instanzbestand auditieren',
    'Führt den read-only Audit für ausgewählte oder aktive Instanzen aus.',
    schemas.auditAll,
    readAnnotations,
    (p) =>
      call(client, {
        path: '/api/v1/iam/instances/audit',
        query: { instanceId: p.instanceIds, includeOnlyActive: p.includeOnlyActive },
      })
  );
  register(
    'studio_instance_diagnose',
    'Studio-Instanz diagnostizieren',
    'Aggregiert Detail-, Keycloak-Preflight- und Status-Evidenz ohne Änderungen.',
    schemas.diagnose,
    readAnnotations,
    async (p) =>
      result({
        ok: true,
        data: await diagnoseInstance(client, p.instanceId, config.diagnosisTimeoutMs),
        meta: {},
      })
  );
  register(
    'studio_instance_keycloak_status',
    'Keycloak-Status lesen',
    'Liest den aktuellen Keycloak-Status einer Studio-Instanz.',
    schemas.instance,
    readAnnotations,
    (p) =>
      call(client, {
        path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/status`,
      })
  );
  register(
    'studio_instance_keycloak_preflight',
    'Keycloak-Preflight lesen',
    'Liest die aktuelle Provisioning-Vorabprüfung einer Studio-Instanz.',
    schemas.instance,
    readAnnotations,
    (p) =>
      call(client, {
        path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/preflight`,
      })
  );
};

export const registerReadTools = (
  register: ToolRegistrar,
  client: StudioApiClient,
  config: StudioMcpConfig
): void => {
  registerCatalogTools(register, client);
  registerInstanceReadTools(register, client, config);
};
