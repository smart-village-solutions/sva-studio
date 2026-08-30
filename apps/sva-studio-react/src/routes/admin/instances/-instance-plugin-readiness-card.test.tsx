import type { PluginTenantReadinessReadModel } from '@sva/plugin-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IamHttpError } from '../../../lib/iam-api';
import { PluginReadinessCard } from './-instance-plugin-readiness-card';

afterEach(() => {
  cleanup();
});

const pluginFixture = (
  overrides: Partial<PluginTenantReadinessReadModel> = {}
): PluginTenantReadinessReadModel => ({
  pluginId: 'speech-flow',
  activationPolicy: 'automatic',
  effectiveActive: true,
  accessState: 'active',
  status: 'blocked',
  evidenceState: 'valid',
  desiredOperation: 'reconcile',
  desiredGeneration: 2,
  completedGeneration: 1,
  checks: [
    {
      checkId: 'configuration',
      titleKey: 'plugins.speechFlow.readiness.configuration',
      required: true,
      repairOperation: 'reconcile',
      status: 'blocked',
    },
  ],
  updatedAt: '2026-08-30T10:00:00.000Z',
  ...overrides,
});

describe('PluginReadinessCard', () => {
  it('renders generic plugin readiness and starts only the declared repair operation', () => {
    const onRepair = vi.fn().mockResolvedValue(undefined);

    render(
      <PluginReadinessCard
        plugins={[pluginFixture()]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={onRepair}
      />
    );

    expect(screen.getByRole('heading', { name: 'speech-flow' })).toBeTruthy();
    expect(screen.getAllByText('Blockiert')).toHaveLength(2);
    expect(screen.getByText('Aktivierungsrichtlinie: Automatisch')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Reparatur für Plugin speech-flow starten' })
    );

    expect(onRepair).toHaveBeenCalledWith('speech-flow', 'reconcile');
  });

  it('does not offer a repair for ready checks and keeps loading and errors accessible', () => {
    const { rerender } = render(
      <PluginReadinessCard
        plugins={[
          pluginFixture({
            status: 'ready',
            checks: [
              {
                checkId: 'configuration',
                titleKey: 'plugins.speechFlow.readiness.configuration',
                required: true,
                repairOperation: 'reconcile',
                status: 'ready',
              },
            ],
          }),
        ]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <PluginReadinessCard
        plugins={[]}
        isLoading={true}
        activeAction={null}
        error={
          new IamHttpError({
            status: 503,
            code: 'plugin_tenant_lifecycle_start_failed',
            message: 'Dienst nicht verfügbar',
          })
        }
        onRepair={vi.fn()}
      />
    );

    expect(screen.getByRole('status').textContent).toContain('Plugin-Status wird geladen');
    expect(screen.getByRole('alert').textContent).toContain('Dienst nicht verfügbar');
  });
});
