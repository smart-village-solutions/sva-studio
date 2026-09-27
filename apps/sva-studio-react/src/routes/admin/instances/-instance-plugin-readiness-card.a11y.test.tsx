import type { PluginTenantReadinessReadModel } from '@sva/plugin-sdk';
import { cleanup, render, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y.js';
import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE, type IamInstanceDetail } from '@sva/core';
import { AccountInvitationTemplateCard } from './-account-invitation-template-card';
import { InstanceDetailCockpitSection } from './-instance-detail-cockpit-section';
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
  it('keeps the invitation dialog fields and error summary accessible', async () => {
    render(
      <AccountInvitationTemplateCard
        instance={
          {
            displayName: 'Demo',
            primaryHostname: 'demo.example.org',
            effectiveAccountInvitationTemplate: {
              ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
              revision: 0,
            },
            accountInvitationTemplateSource: 'sva_default',
          } as IamInstanceDetail
        }
        onSave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await screen.findByRole('link');
    await expectNoA11yViolations(screen.getByRole('dialog'));
  });

  it('keeps mixed setup evidence and its single primary action accessible', async () => {
    const { container } = render(
      <InstanceDetailCockpitSection
        selectedInstance={{} as IamInstanceDetail}
        configurationAssessment={null}
        mutationError={null}
        statusLoading={false}
        onRunDetailAction={vi.fn()}
        cockpitModel={{
          overallStatus: 'blocked',
          overallTitle: 'Blockiert',
          overallSummary: 'Lokaler IAM-Abgleich fehlgeschlagen; Aktivierung bleibt gesperrt.',
          dominantEvidence: { label: 'IAM', source: 'registry', sourceLabel: 'Registry' },
          anomalyQueue: [],
          primaryAction: {
            action: 'retry_tenant_provisioning',
            label: 'Mandanten-Provisionierung erneut starten',
          },
          secondaryActions: [],
          setupSteps: [
            {
              key: 'provision',
              title: 'Technische Bereitstellung',
              description: '',
              status: 'blocked',
            },
          ],
          technicalProgress: [
            { key: 'keycloak', title: 'Keycloak-Konfiguration', status: 'done' },
            { key: 'tenantIam', title: 'Lokaler IAM-Abgleich', status: 'blocked' },
          ],
        }}
      />
    );
    await expectNoA11yViolations(container);
  });
});
