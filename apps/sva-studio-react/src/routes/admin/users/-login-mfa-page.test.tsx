import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setActiveLocale } from '../../../i18n';
const api = vi.hoisted(() => ({ getTenantLoginMfa: vi.fn(), updateTenantLoginMfa: vi.fn() }));
vi.mock('../../../lib/iam-api', () => api);
import { LoginMfaPage } from './-login-mfa-page';
beforeEach(() => {
  setActiveLocale('en');
  api.getTenantLoginMfa.mockResolvedValue({
    data: {
      policy: { desiredMode: 'optional', appliedMode: 'optional', status: 'applied' },
      revision: 1,
    },
  });
  api.updateTenantLoginMfa.mockResolvedValue({
    data: {
      policy: { desiredMode: 'required', appliedMode: 'optional', status: 'pending' },
      revision: 2,
    },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setActiveLocale('de');
});
it('saves tenant-required MFA and keeps the prior verified mode visible while pending', async () => {
  render(<LoginMfaPage />);
  fireEvent.change(await screen.findByLabelText('Ordinary login MFA'), {
    target: { value: 'required' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await vi.waitFor(() =>
    expect(api.updateTenantLoginMfa).toHaveBeenCalledWith({ mode: 'required', expectedRevision: 1 })
  );
  expect(await screen.findByText('Pending verification')).toBeTruthy();
  expect(screen.getByText('Last verified policy: Optional')).toBeTruthy();
});
it('reports failure without claiming that required MFA is applied', async () => {
  api.getTenantLoginMfa.mockResolvedValue({
    data: { policy: { desiredMode: 'required', appliedMode: null, status: 'failed' }, revision: 1 },
  });
  render(<LoginMfaPage />);
  expect(
    await screen.findByText(
      'Application failed. Save again to retry, or contact your administrator.'
    )
  ).toBeTruthy();
  expect(screen.getByText('Last verified policy: Not verified')).toBeTruthy();
});
