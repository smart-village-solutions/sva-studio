import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstanceAuditRunSection } from './-instance-audit-run-section';

describe('InstanceAuditRunSection', () => {
  it('renders fail and skip checks and triggers refresh', () => {
    const onRefresh = vi.fn(async () => undefined);

    render(
      <InstanceAuditRunSection
        title="Audit"
        subtitle="Prueft alle Instanzen."
        emptyMessage="Keine Daten"
        refreshLabel="Audit starten"
        loadingLabel="Laeuft"
        auditLoading={false}
        onRefresh={onRefresh}
        auditRun={{
          generatedAt: '2026-06-10T10:00:00.000Z',
          includeOnlyActive: true,
          targetInstanceIds: ['demo'],
          overallStatus: 'fail',
          summary: {
            totalInstances: 1,
            passCount: 0,
            failCount: 1,
            warnCount: 0,
            skipCount: 1,
          },
          checks: [
            {
              checkId: 'run.targets.present',
              title: 'Ziele geladen',
              scope: 'run',
              status: 'skip',
              expected: 'Instanzen vorhanden',
              actual: 'nicht geprüft',
              evidenceSource: 'instance_registry',
              message: 'Noch nicht geprüft.',
            },
          ],
          instances: [
            {
              instanceId: 'demo',
              displayName: 'Demo',
              primaryHostname: 'demo.example.org',
              status: 'active',
              overallStatus: 'fail',
              checks: [
                {
                  checkId: 'instance.url.reachable',
                  title: 'Instanz erreichbar',
                  scope: 'instance',
                  status: 'fail',
                  expected: 'HTTP 200',
                  actual: 'HTTP 503',
                  evidenceSource: 'https_probe',
                  message: 'Instanz antwortet nicht korrekt.',
                  details: {
                    responseStatus: 503,
                    source: 'live_probe',
                  },
                  remediationHint: 'Ingress prüfen.',
                },
                {
                  checkId: 'registry.instance.active',
                  title: 'Registry aktiv',
                  scope: 'registry',
                  status: 'pass',
                  expected: 'active',
                  actual: 'active',
                  evidenceSource: 'instance_registry',
                  message: 'Instanz ist aktiv.',
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByText('HTTP 503')).toBeTruthy();
    expect(screen.getByText('nicht geprüft')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('responseStatus')).toBeTruthy();
    expect(screen.getByText('503')).toBeTruthy();

    const failBadge = screen.getAllByText('Fail').find((element) => element.tagName === 'SPAN');
    expect(failBadge).toBeTruthy();
    expect(failBadge?.className).toContain('text-destructive');

    const skipBadge = screen.getAllByText('Skip').find((element) => element.tagName === 'SPAN');
    expect(skipBadge).toBeTruthy();
    expect(skipBadge?.className).toContain('text-muted-foreground');

    const passBadge = screen.getAllByText('Pass').find((element) => element.tagName === 'SPAN');
    expect(passBadge).toBeTruthy();
    expect(passBadge?.className).toContain('text-emerald-700');

    fireEvent.click(screen.getByRole('button', { name: 'Audit starten' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
