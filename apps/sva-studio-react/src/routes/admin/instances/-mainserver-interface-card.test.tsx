import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../../lib/iam-api-instances', () => ({
  getRootMainserverInterface: api.get,
  saveRootMainserverInterface: api.save,
}));

import { setActiveLocale } from '../../../i18n';
import { expectNoA11yViolations } from '../../../test/a11y.js';
import { MainserverInterfaceCard } from './-mainserver-interface-card';

afterEach(() => {
  cleanup();
  setActiveLocale('de');
  vi.resetAllMocks();
});

describe('MainserverInterfaceCard', () => {
  it('keeps the configuration form accessible', async () => {
    api.get.mockResolvedValue({
      data: { instanceId: 'bb-prenzlau', status: 'missing', config: null },
    });
    const { container } = render(<MainserverInterfaceCard instanceId="bb-prenzlau" />);
    await screen.findByText('Fehlt');
    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });

  it('loads a missing configuration and saves one instance with readback', async () => {
    api.get.mockResolvedValue({
      data: { instanceId: 'bb-prenzlau', status: 'missing', config: null },
    });
    api.save.mockResolvedValue({
      data: {
        instanceId: 'bb-prenzlau',
        status: 'configured',
        config: {
          graphqlBaseUrl: 'https://server.example.test/graphql',
          oauthTokenUrl: 'https://server.example.test/oauth/token',
          enabled: true,
        },
      },
    });
    render(<MainserverInterfaceCard instanceId="bb-prenzlau" />);
    expect(await screen.findByText('Fehlt')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('GraphQL-URL'), {
      target: { value: 'https://server.example.test/graphql' },
    });
    fireEvent.change(screen.getByLabelText('OAuth-Token-URL'), {
      target: { value: 'https://server.example.test/oauth/token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schnittstelle speichern' }));
    await screen.findByText('Konfiguriert');
    expect(api.save).toHaveBeenCalledWith('bb-prenzlau', {
      graphqlBaseUrl: 'https://server.example.test/graphql',
      oauthTokenUrl: 'https://server.example.test/oauth/token',
      enabled: true,
    });
    expect(screen.getByRole('status').textContent).toContain('gespeichert');
  });

  it('hides the previous instance configuration when the next instance fails to load', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          instanceId: 'bb-prenzlau',
          status: 'configured',
          config: {
            graphqlBaseUrl: 'https://prenzlau.example.test/graphql',
            oauthTokenUrl: 'https://prenzlau.example.test/token',
            enabled: true,
          },
        },
      })
      .mockRejectedValueOnce(new Error('read failed'));
    const { rerender } = render(<MainserverInterfaceCard instanceId="bb-prenzlau" />);
    expect(await screen.findByDisplayValue('https://prenzlau.example.test/graphql')).toBeTruthy();

    rerender(<MainserverInterfaceCard instanceId="bb-spremberg" />);
    await screen.findByText(
      'Mainserver-Schnittstellen konnten nicht geladen oder gespeichert werden. Bitte den Zustand erneut prüfen.'
    );
    expect(screen.queryByDisplayValue('https://prenzlau.example.test/graphql')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Schnittstelle speichern' })).toBeNull();
  });

  it('ignores a save response from a previously selected instance', async () => {
    let finishSave: ((value: unknown) => void) | undefined;
    api.get.mockImplementation(async (instanceId: string) => ({
      data: {
        instanceId,
        status: 'configured',
        config: {
          graphqlBaseUrl: `https://${instanceId}.example.test/graphql`,
          oauthTokenUrl: `https://${instanceId}.example.test/token`,
          enabled: true,
        },
      },
    }));
    api.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        })
    );
    const { rerender } = render(<MainserverInterfaceCard instanceId="bb-prenzlau" />);
    await screen.findByDisplayValue('https://bb-prenzlau.example.test/graphql');
    fireEvent.click(screen.getByRole('button', { name: 'Schnittstelle speichern' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledOnce());

    rerender(<MainserverInterfaceCard instanceId="bb-spremberg" />);
    expect(
      await screen.findByDisplayValue('https://bb-spremberg.example.test/graphql')
    ).toBeTruthy();
    await act(async () => {
      finishSave?.({ data: { instanceId: 'bb-prenzlau', status: 'disabled', config: null } });
    });
    expect(screen.getByDisplayValue('https://bb-spremberg.example.test/graphql')).toBeTruthy();
    expect(screen.queryByText('Deaktiviert')).toBeNull();
  });
});
