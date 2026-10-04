import { createDelegation, revokeDelegation } from './governance-workflow-delegation.js';
import { startImpersonation, endImpersonation } from './governance-workflow-impersonation.js';
import { resolveImpersonationSubject } from './governance-workflow-impersonation-session.js';
import { acceptLegalText } from './governance-workflow-legal.js';
import {
  approvePermissionChange,
  applyPermissionChange,
} from './governance-workflow-permission.js';
import { submitPermissionChange } from './governance-workflow-permission-request.js';
import type {
  GovernanceActor,
  GovernanceWorkflowExecutorDeps,
  GovernanceWorkflowRequest,
  GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';
import type { GovernanceOperation } from './governance-workflow-policy.js';
import type { QueryClient } from './query-client.js';

export type {
  GovernanceActor,
  GovernanceWorkflowExecutorDeps,
  GovernanceWorkflowRequest,
  GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';

type WorkflowHandler = (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
) => Promise<GovernanceWorkflowResponse>;

export const createGovernanceWorkflowExecutor = (deps: GovernanceWorkflowExecutorDeps) => ({
  executeWorkflow: async (
    client: QueryClient,
    actor: GovernanceActor,
    request: GovernanceWorkflowRequest
  ): Promise<GovernanceWorkflowResponse> => {
    const workflowHandlers: Record<GovernanceOperation, WorkflowHandler> = {
      submit_permission_change: (currentClient, currentActor, payload) =>
        submitPermissionChange(deps, currentClient, currentActor, payload),
      approve_permission_change: (currentClient, currentActor, payload) =>
        approvePermissionChange(deps, currentClient, currentActor, payload),
      apply_permission_change: (currentClient, currentActor, payload) =>
        applyPermissionChange(deps, currentClient, currentActor, payload),
      create_delegation: (currentClient, currentActor, payload) =>
        createDelegation(deps, currentClient, currentActor, payload),
      revoke_delegation: (currentClient, currentActor, payload) =>
        revokeDelegation(deps, currentClient, currentActor, payload),
      start_impersonation: (currentClient, currentActor, payload) =>
        startImpersonation(deps, currentClient, currentActor, payload),
      end_impersonation: (currentClient, currentActor, payload) =>
        endImpersonation(deps, currentClient, currentActor, payload),
      accept_legal_text: (currentClient, currentActor, payload) =>
        acceptLegalText(deps, currentClient, currentActor, payload, false),
      revoke_legal_acceptance: (currentClient, currentActor, payload) =>
        acceptLegalText(deps, currentClient, currentActor, payload, true),
    };

    return workflowHandlers[request.operation](client, actor, request.payload);
  },

  resolveImpersonationSubject: async (input: {
    withInstanceScopedDb: <T>(
      instanceId: string,
      work: (client: QueryClient) => Promise<T>
    ) => Promise<T>;
    instanceId: string;
    actorKeycloakSubject: string;
    targetKeycloakSubject: string;
  }): Promise<{ ok: true } | { ok: false; reasonCode: string }> =>
    resolveImpersonationSubject(deps, input),
});
