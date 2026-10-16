/** User-visible key lifecycle and transient-secret regression tests. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), mutate: vi.fn() }));
vi.mock('../../../lib/iam-api-instance-bus-keys', () => ({
  listInstanceBusKeys: api.list,
  createInstanceBusKey: api.create,
  mutateInstanceBusKey: api.mutate,
}));
import { BusApiKeysCard } from './-bus-api-keys-card';
import { setActiveLocale } from '../../../i18n';
import { expectNoA11yViolations } from '../../../test/a11y.js';
import { IamHttpError } from '../../../lib/iam-http-client';
const props = { instanceId: 'bb-town', displayName: 'Town', status: 'active' as const };
const key = {
  keyId: 'key-old',
  owner: 'Town',
  label: 'bb-town',
  contact: 'client@example.test',
  createdBy: 'dk',
  revoked: false,
  createdAt: '2026-01-01T00:00:00Z',
};
const openForm = async () => {
  await screen.findByText('Keine Bus-API-Keys für diese Instanz vorhanden.');
  fireEvent.click(screen.getByRole('button', { name: 'Key erstellen' }));
  fireEvent.change(screen.getByLabelText('Kontakt-E-Mail des Kunden'), {
    target: { value: 'customer@example.test' },
  });
  fireEvent.change(screen.getByLabelText('Erstellerinitialen'), { target: { value: 'dk' } });
};
const submit = () => fireEvent.submit(screen.getByLabelText('Erstellerinitialen').closest('form')!);
beforeEach(() => {
  setActiveLocale('de');
  api.list.mockResolvedValue({ data: [] });
  api.create.mockResolvedValue({
    data: { keyId: 'new-key', apiKey: 'sk_one_time', auditRecorded: true },
  });
  api.mutate.mockResolvedValue({ data: { keyId: 'key-old', auditRecorded: true } });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  setActiveLocale('de');
});

describe('BusApiKeysCard', () => {
  it('restores focus to creation after cancelling the form', async () => {
    render(<BusApiKeysCard {...props} />);
    await screen.findByText('Keine Bus-API-Keys für diese Instanz vorhanden.');
    const trigger = screen.getByRole('button', { name: 'Key erstellen' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it.each(['cancel', 'failure'])('restores focus to revocation after %s', async (outcome) => {
    api.list.mockResolvedValue({ data: [key] });
    api.mutate.mockRejectedValue(new IamHttpError({ status: 502, code: 'bus_unavailable', message: 'unavailable' }));
    render(<BusApiKeysCard {...props} />);
    await screen.findByText('key-old');
    const trigger = screen.getByRole('button', { name: 'Sperren' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: outcome === 'cancel' ? 'Abbrechen' : 'Key jetzt sperren' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it.each(['success', 'failure'])('ignores a previous key clipboard %s after another key is created', async (outcome) => {
    let resolveCopy: () => void = () => undefined;
    let rejectCopy: (error: Error) => void = () => undefined;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: vi.fn(() => new Promise<void>((resolve, reject) => {
        resolveCopy = resolve;
        rejectCopy = reject;
      })),
    } });
    api.create.mockResolvedValueOnce({ data: { keyId: 'key-a', apiKey: 'sk_a', auditRecorded: true } });
    render(<BusApiKeysCard {...props} />);
    await openForm();
    submit();
    await screen.findByText('sk_a');
    fireEvent.click(screen.getByRole('button', { name: 'Key kopieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, ich habe den API-Key kopiert' }));
    await openForm();
    submit();
    await screen.findByText('sk_one_time');
    await act(async () => {
      if (outcome === 'success') resolveCopy();
      else rejectCopy(new Error('clipboard denied'));
    });
    expect(screen.getByRole('status').querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('dialog').querySelector('[role="alert"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });
  it.each([
    ['bus_unavailable', 'Der Bus-Dienst ist derzeit nicht erreichbar oder hat die Anfrage abgelehnt.'],
    ['bus_outcome_unknown', 'Die Sperrung konnte nicht bestätigt werden.'],
  ])('shows an appropriate revocation error for %s', async (code, message) => {
    api.list.mockResolvedValue({ data: [key] });
    api.mutate.mockRejectedValue(new IamHttpError({ status: 502, code, message: code }));
    render(<BusApiKeysCard {...props} />);
    await screen.findByText('key-old');
    fireEvent.click(screen.getByRole('button', { name: 'Sperren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key jetzt sperren' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message));
    expect(screen.getByRole('alert').textContent).not.toContain('erstellt');
    expect(api.mutate).toHaveBeenCalledTimes(1);
  });
  it('offers explicit fresh reauthentication after a rejected creation without retrying it', async () => {
    api.create.mockRejectedValue(
      new IamHttpError({ status: 403, code: 'reauth_required', message: 'reauth_required' })
    );
    render(<BusApiKeysCard {...props} />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-12-31' },
    });
    submit();
    const link = await screen.findByRole('link', { name: 'Erneut anmelden' });
    expect(link.closest('[role="alert"]')).toBe(screen.getByRole('alert'));
    const url = new URL(link.getAttribute('href')!, 'http://studio.localhost:3000');
    expect(url.pathname).toBe('/auth/login');
    expect(url.searchParams.get('reauth')).toBe('1');
    expect(url.searchParams.get('returnTo')).toBe('/admin/instances/bb-town');
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it('keeps missing configuration local and prevents a creation attempt', async () => {
    api.list.mockRejectedValue(
      new IamHttpError({ status: 503, code: 'bus_not_configured', message: 'bus_not_configured' })
    );
    render(<BusApiKeysCard {...props} />);
    await screen.findByText(/Bus-Anbindung ist.*nicht konfiguriert/u);
    expect(
      (screen.getByRole('button', { name: 'Key erstellen' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
  });
  it('validates metadata and previews the inclusive UTC expiry', async () => {
    render(<BusApiKeysCard {...props} />);
    await openForm();
    const year = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone: 'Europe/Berlin',
    }).format(new Date());
    expect((screen.getByLabelText('Gültig bis einschließlich') as HTMLInputElement).value).toBe(
      `${year}-12-31`
    );
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-02-29' },
    });
    expect(screen.getByText(/2028-03-01T00:00:00.000Z/u)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Erstellerinitialen'), { target: { value: '123' } });
    submit();
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')[0].textContent).toContain('gültige Kontakt');
  });
  it('shows the secret only once and copies only after an explicit click', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    render(<BusApiKeysCard {...props} />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-12-31' },
    });
    submit();
    await screen.findByText('sk_one_time');
    expect(screen.queryByText('new-key')).toBeNull();
    expect(clipboard.writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Key kopieren' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith('sk_one_time'));
    await waitFor(() => expect(screen.getByRole('status').querySelector('[aria-hidden="true"]')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(screen.queryByText('sk_one_time')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Key erstellen' })));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('apiKey')).toBeNull();
    expect(sessionStorage.getItem('apiKey')).toBeNull();
  });
  it('still asks before closing when clipboard writing fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')) },
    });
    render(<BusApiKeysCard {...props} />);
    await openForm();
    submit();
    await screen.findByText('sk_one_time');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Key kopieren' })));
    expect(screen.getByRole('dialog').querySelector('[role="alert"]')?.textContent).toBe(
      'Der Key konnte nicht kopiert werden. Bitte den angezeigten Wert manuell übernehmen.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, ich habe den API-Key kopiert' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByText('sk_one_time')).toBeNull();
  });
  it('returns to the same key when copying is still needed', async () => {
    render(<BusApiKeysCard {...props} />);
    await openForm();
    submit();
    await screen.findByText('sk_one_time');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('nur einmal');
    fireEvent.click(screen.getByRole('button', { name: 'Nein, ich muss den API-Key noch kopieren' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('sk_one_time')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Key kopieren' })).toBeTruthy();
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it('ignores a delayed create response even after navigating A → B → A', async () => {
    let finish: (value: unknown) => void = () => undefined;
    api.create.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const view = render(<BusApiKeysCard {...props} />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-12-31' },
    });
    submit();
    view.rerender(<BusApiKeysCard {...props} instanceId="other-town" />);
    view.rerender(<BusApiKeysCard {...props} />);
    await act(async () =>
      finish({ data: { keyId: 'new-key', apiKey: 'sk_late', auditRecorded: true } })
    );
    expect(screen.queryByText('sk_late')).toBeNull();
  });
  it('discards an already displayed secret on instance switch', async () => {
    const view = render(<BusApiKeysCard {...props} />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-12-31' },
    });
    submit();
    await screen.findByText('sk_one_time');
    view.rerender(<BusApiKeysCard {...props} instanceId="other-town" />);
    expect(screen.queryByText('sk_one_time')).toBeNull();
  });
  it('reloads metadata after an ambiguous creation without retrying the write', async () => {
    api.create.mockRejectedValue(new Error('timeout'));
    render(<BusApiKeysCard {...props} />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-12-31' },
    });
    submit();
    await screen.findByText(/Der Ausgang konnte nicht bestätigt/u);
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it('retains the ambiguous write explanation when metadata reload also fails', async () => {
    api.create.mockRejectedValue(new Error('timeout'));
    api.list.mockResolvedValueOnce({ data: [] }).mockRejectedValue(new Error('offline'));
    render(<BusApiKeysCard {...props} />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Gültig bis einschließlich'), {
      target: { value: '2028-12-31' },
    });
    submit();
    await screen.findByText(/Der Ausgang konnte nicht bestätigt/u);
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Bus-API-Keys konnten nicht geladen/u)).toBeNull();
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it('filters labels and requires explicit revocation confirmation', async () => {
    api.list.mockResolvedValue({
      data: [key, { ...key, keyId: 'foreign', label: 'bb-town-more' }],
    });
    render(<BusApiKeysCard {...props} />);
    await screen.findByText('key-old');
    expect(screen.queryByText('foreign')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sperren' }));
    expect(api.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Key jetzt sperren' }));
    await waitFor(() => expect(api.mutate).toHaveBeenCalledWith('bb-town', 'key-old', 'revoke'));
  });
  it('keeps suspended instances readable while disabling creation and activation', async () => {
    api.list.mockResolvedValue({ data: [{ ...key, revoked: true }] });
    render(<BusApiKeysCard {...props} status="suspended" />);
    await screen.findByText('key-old');
    expect(
      (screen.getByRole('button', { name: 'Key erstellen' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Reaktivieren' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
  it('provides accessible form labels and dialogs', async () => {
    const { container } = render(<BusApiKeysCard {...props} />);
    await screen.findByText('Keine Bus-API-Keys für diese Instanz vorhanden.');
    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
    await openForm();
    // Audit the active modal, as other Radix dialog tests do; happy-dom cannot model its inert background.
    await expect(expectNoA11yViolations(screen.getByRole('dialog'))).resolves.toBeUndefined();
  });
  it('renders English resources', async () => {
    setActiveLocale('en');
    render(<BusApiKeysCard {...props} />);
    await screen.findByText('No Bus API keys exist for this instance.');
    expect(screen.getByRole('button', { name: 'Create key' })).toBeTruthy();
  });
  it('keeps legacy instants exact and displays inclusive dates only at UTC day boundaries', async () => {
    api.list.mockResolvedValue({
      data: [
        { ...key, expiresAt: '2027-01-01T00:00:00.000Z' },
        { ...key, keyId: 'legacy', expiresAt: '2027-03-15T15:37:21.123Z' },
      ],
    });
    render(<BusApiKeysCard {...props} />);
    await screen.findByText('2026-12-31');
    expect(screen.getByText('2027-03-15T15:37:21.123Z')).toBeTruthy();
    expect(screen.queryByText('2027-03-14')).toBeNull();
  });
});
