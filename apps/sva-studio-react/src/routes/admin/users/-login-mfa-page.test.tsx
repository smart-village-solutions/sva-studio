import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  vi.useRealTimers();
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

it('reports initial read failure without offering an unverified save form', async () => {
  api.getTenantLoginMfa.mockRejectedValueOnce(new Error('unavailable'));
  render(<LoginMfaPage />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save policy' })).toBeNull();
  expect(api.updateTenantLoginMfa).not.toHaveBeenCalled();
});

it.each([false, true])(
  'polls pending provider verification and handles read failure=%s truthfully',
  async (fails) => {
    vi.useFakeTimers();
    api.getTenantLoginMfa.mockResolvedValueOnce({
      data: {
        policy: { desiredMode: 'required', appliedMode: 'optional', status: 'pending' },
        revision: 2,
      },
    });
    if (fails) api.getTenantLoginMfa.mockRejectedValueOnce(new Error('unavailable'));
    else
      api.getTenantLoginMfa.mockResolvedValueOnce({
        data: {
          policy: { desiredMode: 'required', appliedMode: 'required', status: 'applied' },
          revision: 2,
        },
      });
    const view = render(<LoginMfaPage />);
    await act(async () => undefined);
    expect(screen.getByText('Pending verification')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(api.getTenantLoginMfa).toHaveBeenCalledTimes(2);
    if (fails) {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Last verified policy: Optional')).toBeTruthy();
    } else {
      expect(screen.getByText('Last verified policy: Required')).toBeTruthy();
      expect(screen.queryByText('Pending verification')).toBeNull();
    }
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(api.getTenantLoginMfa).toHaveBeenCalledTimes(2);
  }
);

it.each([false, true])(
  'retains verification evidence after save failure and reload failure=%s',
  async (reloadFails) => {
    render(<LoginMfaPage />);
    const select = await screen.findByLabelText('Ordinary login MFA');
    fireEvent.change(select, { target: { value: 'required' } });
    api.updateTenantLoginMfa.mockRejectedValueOnce(new Error('revision_conflict'));
    if (reloadFails) api.getTenantLoginMfa.mockRejectedValueOnce(new Error('unavailable'));
    else
      api.getTenantLoginMfa.mockResolvedValueOnce({
        data: {
          policy: { desiredMode: 'optional', appliedMode: 'optional', status: 'applied' },
          revision: 8,
        },
      });
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await vi.waitFor(() => expect((select as HTMLSelectElement).disabled).toBe(false));
    expect(screen.getByText('Last verified policy: Optional')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
    await vi.waitFor(() =>
      expect(api.updateTenantLoginMfa).toHaveBeenLastCalledWith({
        mode: 'required',
        expectedRevision: reloadFails ? 1 : 8,
      })
    );
  }
);
