import type { PluginTenantReadinessReadModel } from '@sva/plugin-sdk';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y.js';
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
  cleanup();
});

const plugin: PluginTenantReadinessReadModel = {
  pluginId: 'speech-flow',
  activationPolicy: 'automatic',
  effectiveActive: true,
  accessState: 'active',
  status: 'blocked',
  evidenceState: 'valid',
  desiredOperation: 'reconcile',
  desiredGeneration: 2,
  completedGeneration: 1,
  activeJobId: 'job-42',
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
};

describe('PluginReadinessCard accessibility', () => {
  it('has no detectable accessibility violations with status and actions', async () => {
    const { container } = render(
      <PluginReadinessCard
        plugins={[plugin]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });
});
