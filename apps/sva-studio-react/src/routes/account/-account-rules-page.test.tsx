import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountRulesPage } from './-account-rules-page';

const getMyDeletionRulesMock = vi.fn();
const saveMyDeletionRulesContentPreferenceMock = vi.fn();

vi.mock('../../lib/iam-api', () => ({
  getMyDeletionRules: (...args: unknown[]) => getMyDeletionRulesMock(...args),
  saveMyDeletionRulesContentPreference: (...args: unknown[]) =>
    saveMyDeletionRulesContentPreferenceMock(...args),
}));

describe('AccountRulesPage', () => {
  beforeEach(() => {
    getMyDeletionRulesMock.mockReset();
    saveMyDeletionRulesContentPreferenceMock.mockReset();

    getMyDeletionRulesMock.mockResolvedValue({
      instanceId: 'de-test',
      lastLoginAt: '2026-06-03T10:00:00.000Z',
      lifecycleState: 'active',
      rules: {
        instanceId: 'de-test',
        allowContentPreferenceOverride: true,
        defaultContentStrategy: 'retain',
        deactivateAfterDays: 90,
        pseudonymizeAfterDays: 180,
        deleteAfterDays: 365,
        canEdit: false,
      },
      contentPreference: { isOverridden: false, effectiveStrategy: 'retain' },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders summary cards and the personal content rule dropdown', async () => {
    render(<AccountRulesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kontoregeln' })).toBeTruthy();
    });

    expect(screen.getByText('Deaktivierung nach')).toBeTruthy();
    expect(screen.getByText('Pseudonymisierung nach')).toBeTruthy();
    expect(screen.getByText('Löschung nach')).toBeTruthy();
    expect(screen.getByLabelText('Regel für eigene Inhalte')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inhaltsregel speichern' })).toBeTruthy();
  });

  it('hides the personal settings section when the tenant disables overrides', async () => {
    getMyDeletionRulesMock.mockResolvedValue({
      instanceId: 'de-test',
      lastLoginAt: '2026-06-03T10:00:00.000Z',
      lifecycleState: 'active',
      rules: {
        instanceId: 'de-test',
        allowContentPreferenceOverride: false,
        defaultContentStrategy: 'retain',
        deactivateAfterDays: 90,
        pseudonymizeAfterDays: 180,
        deleteAfterDays: 365,
        canEdit: false,
      },
      contentPreference: { isOverridden: false, effectiveStrategy: 'retain' },
    });

    render(<AccountRulesPage />);

    await waitFor(() => {
      expect(screen.queryByLabelText('Regel für eigene Inhalte')).toBeNull();
    });
  });

  it('saves a personal content override', async () => {
    saveMyDeletionRulesContentPreferenceMock.mockResolvedValue({
      instanceId: 'de-test',
      lastLoginAt: '2026-06-03T10:00:00.000Z',
      lifecycleState: 'active',
      rules: {
        instanceId: 'de-test',
        allowContentPreferenceOverride: true,
        defaultContentStrategy: 'retain',
        deactivateAfterDays: 90,
        pseudonymizeAfterDays: 180,
        deleteAfterDays: 365,
        canEdit: false,
      },
      contentPreference: {
        isOverridden: true,
        effectiveStrategy: 'with_owner_lifecycle',
        overrideStrategy: 'with_owner_lifecycle',
      },
    });

    render(<AccountRulesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Regel für eigene Inhalte')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Regel für eigene Inhalte'), {
      target: { value: 'with_owner_lifecycle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inhaltsregel speichern' }));

    await waitFor(() => {
      expect(saveMyDeletionRulesContentPreferenceMock).toHaveBeenCalledWith({
        strategy: 'with_owner_lifecycle',
      });
      expect(screen.getByText('Die Inhaltsregel wurde gespeichert.')).toBeTruthy();
    });
  });
});
