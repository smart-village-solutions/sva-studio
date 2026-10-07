import type { StudioApiClient } from './api-client.js';
import type { StudioMcpConfig } from './config.js';
import { schemas } from './contracts.js';
import { call, mutation, writeAnnotations, type ToolRegistrar } from './tools-support.js';

const registerInstanceWriteTools = (
  register: ToolRegistrar,
  client: StudioApiClient,
  config: StudioMcpConfig
): void => {
  register(
    'studio_instances_create',
    'Studio-Instanz erstellen',
    'Erstellt idempotent eine Registry-Instanz; Provisionierung und Aktivierung bleiben getrennt. adoptExisting im tenantAdminBootstrap erlaubt nur bei exaktem Username- und eindeutigem E-Mail-Treffer die Übernahme eines unmarkierten Bestands-Admins.',
    schemas.create,
    writeAnnotations,
    (p) =>
      call(client, mutation('/api/v1/iam/instances', p, 'POST', true), {
        instanceId: p.instanceId,
        timeoutMs: config.diagnosisTimeoutMs,
      })
  );
  register(
    'studio_instance_update',
    'Studio-Instanz aktualisieren',
    'Aktualisiert die Konfiguration einer vorhandenen Instanz idempotent.',
    schemas.update,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}`, p, 'PATCH'),
        { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }
      )
  );
  register(
    'studio_instance_provisioning_plan',
    'Provisionierung planen',
    'Erzeugt den serverseitigen Keycloak-Provisioning-Plan ohne ihn auszuführen.',
    schemas.plan,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/plan`, p)
      )
  );
  register(
    'studio_instance_provisioning_execute',
    'Provisionierung ausführen',
    'Startet eine zuvor geprüfte Keycloak-Provisionierung asynchron.',
    schemas.execute,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/execute`, p),
        { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }
      )
  );
};

const registerProvisioningWriteTools = (
  register: ToolRegistrar,
  client: StudioApiClient,
  config: StudioMcpConfig
): void => {
  register(
    'studio_instance_reconcile',
    'Instanz abgleichen',
    'Gleicht die Keycloak-Artefakte kontrolliert ab; Secret-Rotation ist ausgeschlossen.',
    schemas.reconcile,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/reconcile`, p),
        { instanceId: p.instanceId, timeoutMs: config.diagnosisTimeoutMs }
      )
  );
};

const registerModuleWriteTools = (register: ToolRegistrar, client: StudioApiClient): void => {
  register(
    'studio_instance_module_assign',
    'Modul zuweisen',
    'Weist einer Instanz idempotent ein Modul zu.',
    schemas.assignModule,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/assign`, p)
      )
  );
  register(
    'studio_instance_iam_baseline_seed',
    'IAM-Baseline seeden',
    'Seedet die IAM-Baseline der zugewiesenen Module.',
    schemas.seed,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(
          `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/seed-iam-baseline`,
          p
        )
      )
  );
  register(
    'studio_instance_tenant_iam_access_probe',
    'Tenant-IAM-Zugriff prüfen',
    'Prüft die tenantlokale IAM-Zugriffsverbindung einer Instanz.',
    schemas.accessProbe,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(
          `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/tenant-iam/access-probe`,
          p
        )
      )
  );
};

const registerIamWriteTools = (register: ToolRegistrar, client: StudioApiClient): void => {
  register(
    'studio_instance_iam_roles_reconcile',
    'Tenant-Rollen abgleichen',
    'Gleicht den Rollen-Katalog einer Instanz kontrolliert ab.',
    schemas.roleReconcile,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(
          `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/tenant-iam/roles/reconcile`,
          p
        )
      )
  );
  register(
    'studio_instance_admin_bootstrap',
    'Admin-Struktur bootstrappen',
    'Erzeugt die Admin-Struktur für ausgewählte Module.',
    schemas.bootstrap,
    writeAnnotations,
    (p) =>
      call(
        client,
        mutation(
          `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/bootstrap-admin-structure`,
          p
        )
      )
  );
};

export const registerWriteTools = (
  register: ToolRegistrar,
  client: StudioApiClient,
  config: StudioMcpConfig
): void => {
  registerInstanceWriteTools(register, client, config);
  registerProvisioningWriteTools(register, client, config);
  registerModuleWriteTools(register, client);
  registerIamWriteTools(register, client);
};
