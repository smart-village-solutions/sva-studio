import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    api.get.mockResolvedValue({ data: { instanceId: 'bb-prenzlau', status: 'missing', config: null } });
    const { container } = render(<MainserverInterfaceCard instanceId="bb-prenzlau" />);
    await screen.findByText('Fehlt');
    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });

  it('loads a missing configuration and saves one instance with readback', async () => {
    api.get.mockResolvedValue({ data: { instanceId: 'bb-prenzlau', status: 'missing', config: null } });
    api.save.mockResolvedValue({ data: { instanceId: 'bb-prenzlau', status: 'configured', config: {
      graphqlBaseUrl: 'https://server.example.test/graphql',
      oauthTokenUrl: 'https://server.example.test/oauth/token',
      enabled: true,
    } } });
    render(<MainserverInterfaceCard instanceId="bb-prenzlau" />);
    expect(await screen.findByText('Fehlt')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('GraphQL-URL'), { target: { value: 'https://server.example.test/graphql' } });
    fireEvent.change(screen.getByLabelText('OAuth-Token-URL'), { target: { value: 'https://server.example.test/oauth/token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schnittstelle speichern' }));
    await screen.findByText('Konfiguriert');
    expect(api.save).toHaveBeenCalledWith('bb-prenzlau', {
      graphqlBaseUrl: 'https://server.example.test/graphql',
      oauthTokenUrl: 'https://server.example.test/oauth/token',
      enabled: true,
    });
    expect(screen.getByRole('status').textContent).toContain('gespeichert');
  });
});
