import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getDiagnostics: vi.fn(),
}));

vi.mock('../../lib/iam-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/iam-api')>()),
  getMainserverAuthoringDiagnostics: state.getDiagnostics,
}));

import { MainserverAuthoringDiagnosticsPanel } from './-mainserver-authoring-diagnostics';

const diagnostics = {
  bindings: {
    byStatus: { verified: 7, conflict: 2 },
    byPrincipalType: { user: 5, organization: 4 },
    rotationPrincipalCount: 3,
    recent: [],
  },
  mutations: {
    byAuthorizationMode: { exact: 11, credential_visible_compatibility: 13 },
    byResolverMode: { shadow: 17, automatic: 7 },
    byReconciliationStatus: { reconciliation_required: 4, failed: 1 },
    automaticModeSwitchCount: 6,
    shadowDifferenceCount: 5,
    recent: [],
  },
};

describe('MainserverAuthoringDiagnosticsPanel', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    state.getDiagnostics.mockResolvedValue({ data: diagnostics });
  });

  it('does not request or expose diagnostics without monitoring permission', () => {
    const { container } = render(<MainserverAuthoringDiagnosticsPanel enabled={false} />);

    expect(container.childElementCount).toBe(0);
    expect(state.getDiagnostics).not.toHaveBeenCalled();
  });

  it('renders the automatic binding, mode-switch, and reconciliation metrics read-only', async () => {
    render(<MainserverAuthoringDiagnosticsPanel enabled />);

    expect(screen.getByRole('status').textContent).toContain('Autorendiagnose wird geladen');
    expect(await screen.findByRole('heading', { name: 'Mainserver-Autorendiagnose' })).toBeTruthy();

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByText('Bestätigte Bindungen').nextElementSibling?.textContent).toBe('7');
    expect(screen.getByText('Bindungskonflikte').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Principals mit Rotation').nextElementSibling?.textContent).toBe('3');
    expect(screen.getByText('Kompatibilitätsentscheidungen').nextElementSibling?.textContent).toBe(
      '13'
    );
    expect(screen.getByText('Exakte Entscheidungen').nextElementSibling?.textContent).toBe('11');
    expect(screen.getByText('Automatische Moduswechsel').nextElementSibling?.textContent).toBe('6');
    expect(screen.getByText('Shadow-Auswertungen').nextElementSibling?.textContent).toBe('17');
    expect(screen.getByText('Shadow-Abweichungen').nextElementSibling?.textContent).toBe('5');
    expect(screen.getByText('Abgleich erforderlich').nextElementSibling?.textContent).toBe('4');
    expect(screen.getByText('Abgleich fehlgeschlagen').nextElementSibling?.textContent).toBe('1');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Eine manuelle Zuordnung ist nicht verfügbar/)).toBeTruthy();
  });

  it('announces failures and retries only the read operation', async () => {
    state.getDiagnostics.mockRejectedValueOnce(new Error('offline'));
    render(<MainserverAuthoringDiagnosticsPanel enabled />);

    expect(
      await screen.findByText('Die Mainserver-Autorendiagnose konnte nicht geladen werden.')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    await waitFor(() => expect(state.getDiagnostics).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Bestätigte Bindungen')).toBeTruthy();
  });
});
