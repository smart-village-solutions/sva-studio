import type { PluginTenantReadinessReadModel } from '@sva/plugin-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setActiveLocale } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';
import { PluginReadinessCard } from './-instance-plugin-readiness-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    params: { jobId: string };
    to: string;
  }) => (
    <a href={to.replace('$jobId', params.jobId)} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  setActiveLocale('de');
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

  it('links an active lifecycle job through the existing monitoring route', () => {
    render(
      <PluginReadinessCard
        plugins={[pluginFixture({ activeJobId: 'job-42' })]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(
      screen
        .getByRole('link', { name: 'Aktiven Job für Plugin speech-flow öffnen' })
        .getAttribute('href')
    ).toBe('/monitoring/jobs/job-42');
    expect(
      (
        screen.getByRole('button', {
          name: 'Reparatur für Plugin speech-flow starten',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('renders the generic controls in English when English is active', () => {
    setActiveLocale('en');

    render(
      <PluginReadinessCard
        plugins={[pluginFixture({ activeJobId: 'job-42' })]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Plugin readiness' })).toBeTruthy();
    expect(screen.getByText('Activation policy: Automatic')).toBeTruthy();
    expect(screen.getAllByText('Blocked')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Open active job for plugin speech-flow' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Start repair for plugin speech-flow' })
    ).toBeTruthy();
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

  it('offers repair after a terminal failure even when the last checks were ready', () => {
    const onRepair = vi.fn().mockResolvedValue(undefined);
    render(
      <PluginReadinessCard
        plugins={[
          pluginFixture({
            status: 'blocked',
            error: { code: 'reconcile_failed', retryKind: 'terminal' },
            activeJobId: undefined,
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
        onRepair={onRepair}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Reparatur für Plugin speech-flow starten' })
    );
    expect(onRepair).toHaveBeenCalledWith('speech-flow', 'reconcile');
  });
});
