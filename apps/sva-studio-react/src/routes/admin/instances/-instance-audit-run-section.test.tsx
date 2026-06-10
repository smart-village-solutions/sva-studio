import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstanceAuditRunSection } from './-instance-audit-run-section';

describe('InstanceAuditRunSection', () => {
  it('renders the empty state and triggers a refresh', () => {
    const onRefresh = vi.fn(async () => undefined);

    render(
      <InstanceAuditRunSection
        title="Audit"
        subtitle="Prueft aktive Instanzen."
        emptyMessage="Kein Ergebnis"
        refreshLabel="Audit starten"
        loadingLabel="Laeuft"
        auditRun={null}
        auditLoading={false}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText('Kein Ergebnis')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Audit starten' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders run and instance checks including remediation hints', () => {
    render(
      <InstanceAuditRunSection
        title="Audit"
        subtitle="Prueft aktive Instanzen."
        emptyMessage="Kein Ergebnis"
        refreshLabel="Audit starten"
        loadingLabel="Laeuft"
        auditLoading={true}
        onRefresh={vi.fn(async () => undefined)}
        auditRun={{
          generatedAt: '2026-06-10T10:00:00.000Z',
          includeOnlyActive: true,
          targetInstanceIds: ['bb-guben'],
          overallStatus: 'fail',
          summary: {
            totalInstances: 1,
            passCount: 3,
            failCount: 1,
            warnCount: 0,
            skipCount: 0,
          },
          checks: [
            {
              checkId: 'run.targets.present',
              title: 'Zielinstanzen geladen',
              scope: 'run',
              status: 'pass',
              expected: 'Mindestens eine Zielinstanz',
              actual: '1 Instanz',
              evidenceSource: 'instance_registry',
              message: 'Instanzen wurden geladen.',
            },
          ],
          instances: [
            {
              instanceId: 'bb-guben',
              displayName: 'BB Guben',
              status: 'active',
              primaryHostname: 'bb-guben.studio.smart-village.app',
              overallStatus: 'fail',
              checks: [
                {
                  checkId: 'instance.url.reachable',
                  title: 'Instanz-URL erreichbar',
                  scope: 'instance',
                  status: 'fail',
                  expected: 'HTTP 200',
                  actual: 'TypeError',
                  evidenceSource: 'https_probe',
                  message: 'Die Instanz-URL konnte nicht erreicht werden.',
                  remediationHint: 'DNS und Ingress pruefen.',
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('button', { name: 'Laeuft' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('BB Guben')).toBeTruthy();
    expect(screen.getByText('Instanz-URL erreichbar')).toBeTruthy();
    expect(screen.getByText('DNS und Ingress pruefen.')).toBeTruthy();
    expect(screen.getByText('Zielinstanzen geladen')).toBeTruthy();
  });
});
