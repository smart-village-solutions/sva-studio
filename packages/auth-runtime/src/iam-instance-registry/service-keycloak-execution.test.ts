import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  processTargetNextQueuedKeycloakProvisioningRun: vi.fn(async () => null),
  processTargetClaimedKeycloakProvisioningRun: vi.fn(),
  createTargetExecuteKeycloakProvisioningHandler: vi.fn(),
  createTargetReconcileKeycloakHandler: vi.fn(),
  withAuthInstanceRegistryDeps: vi.fn((deps) => ({ ...deps, enriched: true })),
}));

vi.mock('@sva/instance-registry/service-keycloak-execution', () => ({
  processNextQueuedKeycloakProvisioningRun: state.processTargetNextQueuedKeycloakProvisioningRun,
  processClaimedKeycloakProvisioningRun: state.processTargetClaimedKeycloakProvisioningRun,
  createExecuteKeycloakProvisioningHandler: state.createTargetExecuteKeycloakProvisioningHandler,
  createReconcileKeycloakHandler: state.createTargetReconcileKeycloakHandler,
}));

vi.mock('./instance-registry-deps.js', () => ({
  withAuthInstanceRegistryDeps: state.withAuthInstanceRegistryDeps,
}));

describe('iam-instance-registry service-keycloak-execution bindings', () => {
  const originalClaimNotBefore = process.env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalClaimNotBefore === undefined) {
      delete process.env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE;
      return;
    }

    process.env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE = originalClaimNotBefore;
  });

  it('passes the startup claim cutoff to the target worker helper', async () => {
    process.env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE = '2026-05-27T12:00:00.000Z';
    const subject = await import('./service-keycloak-execution.js');

    await expect(subject.processNextQueuedKeycloakProvisioningRun({ repository: {} } as never)).resolves.toBeNull();

    expect(state.processTargetNextQueuedKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ repository: {}, enriched: true }),
      { createdAtOrAfter: '2026-05-27T12:00:00.000Z' },
    );
  });

  it('ignores an invalid startup claim cutoff value', async () => {
    process.env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE = 'not-a-timestamp';
    const subject = await import('./service-keycloak-execution.js');

    await expect(subject.processNextQueuedKeycloakProvisioningRun({ repository: {} } as never)).resolves.toBeNull();

    expect(state.processTargetNextQueuedKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ repository: {}, enriched: true }),
      undefined,
    );
  });

  it('ignores an empty startup claim cutoff value after trimming', async () => {
    process.env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE = '   ';
    const subject = await import('./service-keycloak-execution.js');

    await expect(subject.processNextQueuedKeycloakProvisioningRun({ repository: {} } as never)).resolves.toBeNull();

    expect(state.processTargetNextQueuedKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ repository: {}, enriched: true }),
      undefined,
    );
  });
});
