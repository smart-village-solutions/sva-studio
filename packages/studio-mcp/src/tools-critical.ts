import { randomUUID } from 'node:crypto';
import type { StudioApiClient } from './api-client.js';
import { schemas } from './contracts.js';
import {
  call,
  mutation,
  criticalAnnotations,
  nonIdempotentWriteAnnotations,
  type ToolRegistrar,
} from './tools-support.js';

const registerCriticalStatusTools = (register: ToolRegistrar, client: StudioApiClient): void => {
  register(
    'studio_instance_critical_action_prepare',
    'Kritische Aktion vorbereiten',
    'Erzeugt eine kurzlebige, zustandsgebundene Bestätigungs-Challenge; führt die Aktion nicht aus.',
    schemas.prepareCritical,
    nonIdempotentWriteAnnotations,
    (p) =>
      call(client, {
        method: 'POST',
        path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/actions/${encodeURIComponent(p.actionId)}/confirmation`,
        query: { moduleId: p.moduleId },
        body: {},
        requestId: randomUUID(),
        idempotencyKey: randomUUID(),
      })
  );

  const critical = (
    name: string,
    title: string,
    action: string,
    path: (p: { instanceId: string }) => string,
    body?: Record<string, unknown>
  ) =>
    register(
      name,
      title,
      `Kritische Aktion ${action}; verlangt eine gültige serverseitige Challenge und exakte Bestätigungsphrase.`,
      schemas.critical,
      criticalAnnotations,
      (p) =>
        call(
          client,
          mutation(path(p), {
            ...body,
            challengeId: p.challengeId,
            confirmationPhrase: p.confirmationPhrase,
            idempotencyKey: p.idempotencyKey,
          })
        )
    );
  critical(
    'studio_instance_activate',
    'Instanz aktivieren',
    'instance.status.activate',
    (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/activate`,
    { status: 'active' }
  );
  critical(
    'studio_instance_suspend',
    'Instanz suspendieren',
    'instance.status.suspend',
    (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/suspend`,
    { status: 'suspended' }
  );
  critical(
    'studio_instance_archive',
    'Instanz archivieren',
    'instance.status.archive',
    (p) => `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/archive`,
    { status: 'archived' }
  );
};

const registerCriticalMutationTools = (register: ToolRegistrar, client: StudioApiClient): void => {
  register(
    'studio_instance_module_revoke',
    'Modul entziehen',
    'Entzieht ein Modul nach serverseitiger Challenge und exakter Phrase.',
    schemas.revoke,
    criticalAnnotations,
    (p) =>
      call(
        client,
        mutation(`/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/modules/revoke`, {
          ...p,
          confirmation: 'REVOKE',
        })
      )
  );
  register(
    'studio_instance_secret_rotate',
    'Client-Secret rotieren',
    'Rotiert das Client-Secret nach bestätigtem Keycloak-Plan und gültiger serverseitiger Challenge.',
    schemas.secretRotate,
    criticalAnnotations,
    (p) =>
      call(
        client,
        mutation(
          `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/rotate-secret`,
          { ...p, intent: 'rotate_client_secret' }
        )
      )
  );
};

export const registerCriticalTools = (register: ToolRegistrar, client: StudioApiClient): void => {
  registerCriticalStatusTools(register, client);
  registerCriticalMutationTools(register, client);
};
