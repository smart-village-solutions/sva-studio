import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as localEditingModule from './lib/local-editing';
import { updateWorkPackageAssignment } from './lib/local-editing';
import type { ProjectStatusReport } from './lib/report-model';
import { App } from './app';

const localEditableReportFixture: ProjectStatusReport = {
  meta: {
    version: '1.0.0',
    updatedAt: '2026-06-02',
    source: 'local-test',
  },
  statusModel: {
    idea: 0,
    commissioned: 0,
    planned: 10,
    prototype: 20,
    implementation: 45,
    optimization: 70,
    testing: 80,
    acceptance: 90,
    done: 100,
  },
  healthModel: ['on_track', 'needs_attention', 'at_risk', 'blocked'],
  priorityModel: {
    must: '1: Muss sein',
    replacement_required: '2: Notwendig für die Ablösung des Alt-Systems',
    valuable: '3: Neu, aber sehr sinnvoll',
    requested: '4: Neu und gewünscht',
    funded_optional: '5: Nicht so wichtig, aber finanziert',
    unfunded_nice_to_have: '6: Nice to have, noch ohne Finanzierung',
    irrelevant: '7: Irrelevant',
  },
  milestones: [
    {
      id: 'M1',
      title: 'Alpha Local',
      plannedEffortPt: 3,
      sortOrder: 1,
      workPackages: [
        {
          id: 'WP-201',
          title: 'Lokales Paket',
          area: 'A',
          priority: 'must',
          effortPt: 2,
          status: 'planned',
          health: 'on_track',
          dependsOn: [],
        },
      ],
    },
    {
      id: 'M2',
      title: 'Beta Local',
      plannedEffortPt: 1,
      sortOrder: 2,
      workPackages: [
        {
          id: 'WP-202',
          title: 'Zielpaket',
          area: 'B',
          priority: 'valuable',
          effortPt: 1,
          status: 'done',
          health: 'needs_attention',
          dependsOn: [],
        },
      ],
    },
  ],
};

describe('project report app', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'http://localhost:3000/');
    vi.spyOn(localEditingModule, 'isLocalProjectStatusHost').mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders milestone overview by default and syncs tab changes to the URL', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'SVA Studio Projektdashboard' }).textContent).toBe(
      'SVA Studio Projektdashboard'
    );
    expect(screen.getByRole('tab', { name: 'Meilensteine' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Arbeitspakete' }));

    expect(window.location.search).toContain('view=work-packages');
    expect(screen.getByRole('tab', { name: 'Arbeitspakete' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders the milestone empty state when the URL filters a missing milestone', () => {
    window.history.replaceState({}, '', 'http://localhost:3000/?milestone=missing-milestone');

    render(<App />);

    expect(screen.getByText('Für die aktuellen Filter gibt es keine Einträge.')).toBeTruthy();
  });

  it('renders the work package empty state when the URL filters to no matching entries', () => {
    window.history.replaceState({}, '', 'http://localhost:3000/?view=work-packages&q=kein-treffer');

    render(<App />);

    expect(screen.getByRole('tab', { name: 'Arbeitspakete' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Für die aktuellen Filter gibt es keine Einträge.')).toBeTruthy();
  });

  it('does not emit a React key warning when rendering work package rows', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Arbeitspakete' }));

    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).includes('Each child in a list should have a unique "key" prop')
      )
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('keeps work package rows read-only outside local hosts', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    window.history.replaceState({}, '', 'http://localhost:3000/?view=work-packages');

    render(<App />);

    expect(screen.queryByLabelText('Status für WP-001 bearbeiten')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders local dropdowns and saves milestone changes immediately on local hosts', async () => {
    const updatedReport = updateWorkPackageAssignment(localEditableReportFixture, {
      workPackageId: 'WP-201',
      milestoneId: 'M2',
      priority: 'must',
      status: 'planned',
    });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(localEditableReportFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ report: updatedReport }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(localEditingModule, 'isLocalProjectStatusHost').mockReturnValue(true);

    window.history.replaceState({}, '', 'http://localhost:3000/?view=work-packages');

    render(<App />);

    await screen.findByText('WP-201');

    fireEvent.change(screen.getByLabelText('Meilenstein für WP-201 bearbeiten'), {
      target: { value: 'M2' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/__local/project-status');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/__local/project-status/work-package');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workPackageId: 'WP-201',
          milestoneId: 'M2',
          priority: 'must',
          status: 'planned',
        }),
      })
    );

    await waitFor(() => {
      expect((screen.getByLabelText('Meilenstein für WP-201 bearbeiten') as HTMLSelectElement).value).toBe('M2');
    });
  });

  it('restores the last confirmed report and shows an error when local saving fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(localEditableReportFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'write failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(localEditingModule, 'isLocalProjectStatusHost').mockReturnValue(true);

    window.history.replaceState({}, '', 'http://localhost:3000/?view=work-packages');

    render(<App />);

    await screen.findByText('WP-201');

    fireEvent.change(screen.getByLabelText('Status für WP-201 bearbeiten'), {
      target: { value: 'done' },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Lokale Projektstatus-Änderung konnte nicht gespeichert werden.');
    });
    expect((screen.getByLabelText('Status für WP-201 bearbeiten') as HTMLSelectElement).value).toBe('planned');
  });

  it('filters work packages by status instead of warning level', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Arbeitspakete' }));

    expect(screen.queryByLabelText('Warnstufe')).toBeNull();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'implementation' },
    });

    expect(window.location.search).toContain('status=implementation');
    expect(screen.queryByText('WP-001')).toBeNull();
    expect(screen.getByText('WP-028')).toBeTruthy();
  });

  it('toggles the feature summary below a work package row', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Arbeitspakete' }));

    expect(
      screen.queryByText(/Dieses Arbeitspaket schafft die sichere und mandantenfaehige Eintrittsschicht des Studios\./)
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details für WP-001 anzeigen' }));

    expect(
      screen.getByText(/Dieses Arbeitspaket schafft die sichere und mandantenfaehige Eintrittsschicht des Studios\./)
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Weniger Details für WP-001' }));

    expect(
      screen.queryByText(/Dieses Arbeitspaket schafft die sichere und mandantenfaehige Eintrittsschicht des Studios\./)
    ).toBeNull();
  });
});
