import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveLocale } from '../../../i18n';
import { LanguagesPage } from './-languages-page';
const api = vi.hoisted(() => ({ request: vi.fn(), allowed: false }));
vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => ({
    instances: [{ instanceId: 'tenant', displayName: 'Testkommune' }],
    error: null,
  }),
}));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk')>()),
  requestMainserverJson: api.request,
}));
afterEach(cleanup);
beforeEach(() => {
  setActiveLocale('de');
  api.allowed = false;
  api.request.mockReset();
  api.request.mockImplementation(async () => ({
    data: {
      instanceId: null,
      moduleAllowed: api.allowed,
      languages: [
        { locale: 'de', available: true, revision: '1' },
        { locale: 'en', available: true, revision: '3' },
      ],
      assignments: [],
    },
  }));
});
describe('language management', () => {
  it('orders both language lists by display name with German first', async () => {
    const languages = ['uk', 'en', 'da', 'de', 'zh-Hans'].map((locale) => ({
      locale,
      available: true,
      revision: '1',
    }));
    api.request.mockResolvedValue({ data: { moduleAllowed: true, languages, assignments: [] } });
    render(<LanguagesPage />);
    await screen.findByRole('checkbox', { name: 'Ukrainisch' });
    const labels = () =>
      screen.getAllByRole('checkbox').map((input) => input.closest('label')?.textContent?.trim());
    const expected = ['Deutsch', 'Chinesisch (vereinfacht)', 'Dänisch', 'Englisch', 'Ukrainisch'];
    expect(labels()).toEqual(expected);
    fireEvent.change(screen.getByLabelText('Instanz'), { target: { value: 'tenant' } });
    await waitFor(() => expect(labels()).toEqual([...expected, ...expected]));
    expect(languages.map((language) => language.locale)).toEqual([
      'uk',
      'en',
      'da',
      'de',
      'zh-Hans',
    ]);
  });
  it('does not auto-select an instance and keeps German always available', async () => {
    render(<LanguagesPage />);
    await screen.findByRole('checkbox', { name: 'Englisch' });
    expect((screen.getByLabelText('Instanz') as HTMLSelectElement).value).toBe('');
    expect(api.request.mock.calls[0]?.[0].url).toBe('/api/v1/iam/languages');
    expect((screen.getByRole('checkbox', { name: 'Deutsch' }) as HTMLInputElement).disabled).toBe(
      true
    );
    expect(screen.queryByText(/Zusätzliche Sprachen erfordern/)).toBeNull();
  });
  it('blocks instance activation without the module and writes exact instance/revision when ready', async () => {
    const { unmount } = render(<LanguagesPage />);
    fireEvent.change(screen.getByLabelText('Instanz'), { target: { value: 'tenant' } });
    await screen.findByText(/Zusätzliche Sprachen erfordern/);
    let section = screen
      .getByRole('heading', { name: 'Sprachen einer Instanz' })
      .closest('section')!;
    expect(
      (within(section).getByRole('checkbox', { name: 'Englisch' }) as HTMLInputElement).disabled
    ).toBe(true);
    unmount();
    api.allowed = true;
    render(<LanguagesPage />);
    fireEvent.change(screen.getByLabelText('Instanz'), { target: { value: 'tenant' } });
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/v1/iam/languages?instanceId=tenant' })
      )
    );
    section = screen.getByRole('heading', { name: 'Sprachen einer Instanz' }).closest('section')!;
    await waitFor(() =>
      expect(within(section).getByRole('checkbox', { name: 'Englisch' })).toBeTruthy()
    );
    fireEvent.click(within(section).getByRole('checkbox', { name: 'Englisch' }));
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith(
        expect.objectContaining({
          init: expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              operation: 'assignment',
              instanceId: 'tenant',
              locale: 'en',
              enabled: true,
              expectedRevision: '0',
            }),
          }),
        })
      )
    );
  });
  it('sends the central availability revision and shows failures without claiming success', async () => {
    render(<LanguagesPage />);
    const english = await screen.findByRole('checkbox', { name: 'Englisch' });
    api.request.mockRejectedValueOnce(new Error('conflict'));
    fireEvent.click(english);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({
        init: expect.objectContaining({
          body: JSON.stringify({
            operation: 'availability',
            locale: 'en',
            available: false,
            expectedRevision: '3',
          }),
        }),
      })
    );
  });
});
