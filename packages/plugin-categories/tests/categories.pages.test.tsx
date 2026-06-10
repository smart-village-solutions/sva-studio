import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listCategories: vi.fn(),
}));

vi.mock('../src/categories.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/categories.api.js')>('../src/categories.api.js');
  return {
    ...actual,
    listCategories: state.listCategories,
  };
});

import { CategoriesPage } from '../src/categories.pages.js';

describe('CategoriesPage', () => {
  beforeEach(() => {
    state.listCategories.mockReset();
    registerPluginTranslationResolver((key, variables) => {
      const labels: Record<string, string> = {
        'categories.navigation.title': 'Kategorien',
        'categories.list.title': 'Kategorien',
        'categories.list.description': 'Lesen Sie die Kategorien aus dem Mainserver in einer schreibgeschuetzten Uebersicht.',
        'categories.fields.actions': 'Aktionen',
        'categories.fields.name': 'Name',
        'categories.fields.id': 'ID',
        'categories.fields.hierarchy': 'Hierarchie',
        'categories.fields.position': 'Position',
        'categories.fields.tags': 'Tags',
        'categories.fields.createdAt': 'Erstellt am',
        'categories.values.notAvailable': '—',
        'categories.values.readOnlyHint': 'Aktionen werden in einem spaeteren Schritt freigeschaltet.',
        'categories.actions.edit': 'Bearbeiten',
        'categories.actions.createChild': 'Neue Unterkategorie',
        'categories.actions.delete': 'Löschen',
        'categories.actions.reload': 'Erneut laden',
        'categories.empty.title': 'Aktuell wurden keine Kategorien aus dem Mainserver geladen.',
        'categories.empty.description': 'Sobald Kategorien vorhanden sind, erscheinen sie hier als flache Tabelle.',
        'categories.messages.loading': 'Kategorien werden geladen.',
        'categories.messages.loadError': 'Kategorien konnten nicht geladen werden.',
        'categories.messages.loadErrorMissingCredentials':
          'Für den aktuellen Kontext fehlen Mainserver-Zugangsdaten. Bitte wählen Sie eine Organisation mit gepflegten Mainserver-Credentials oder hinterlegen Sie persönliche Mainserver-Zugangsdaten.',
        'categories.messages.loadErrorIntegrationDisabled':
          'Die Mainserver-Integration ist für diese Instanz derzeit nicht aktiv.',
        'categories.messages.loadErrorConfigMissing':
          'Für diese Instanz ist noch keine Mainserver-Konfiguration hinterlegt.',
        'categories.messages.loadErrorForbidden':
          'Zum Laden der Kategorien fehlt die Berechtigung categories.read.',
        'categories.messages.actionsHint': 'Die Seite ist vorerst read-only.',
        'categories.table.ariaLabel': 'Kategorien-Tabelle',
        'categories.table.caption': 'Flache Ansicht der Mainserver-Kategorien',
      };

      if (key === 'categories.table.countLabel') {
        return `${variables?.count ?? 0} Kategorien`;
      }

      return labels[key] ?? key;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading and then the flat categories table with disabled actions', async () => {
    state.listCategories.mockResolvedValueOnce([
      {
        id: 'cat-root',
        name: 'Service',
        position: 1,
        tagList: 'amt, buerger',
      },
      {
        id: 'cat-child',
        name: 'Buergerbuero',
        position: 2,
        tagList: 'vor-ort',
        parent: {
          name: 'Service',
        },
      },
    ]);

    render(<CategoriesPage />);

    expect(screen.getByText('Kategorien werden geladen.')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kategorien' })).toBeTruthy();
      expect(screen.getByRole('table', { name: 'Kategorien-Tabelle' })).toBeTruthy();
      expect(screen.getAllByText('Service').length).toBeGreaterThan(0);
      expect(screen.getAllByText('amt').length).toBeGreaterThan(0);
      expect(screen.getAllByText('buerger').length).toBeGreaterThan(0);
      expect(screen.queryByRole('columnheader', { name: 'Icon' })).toBeNull();
      expect(screen.queryByRole('columnheader', { name: 'Aktualisiert' })).toBeNull();
    });

    expect(screen.getAllByRole('button', { name: 'Bearbeiten' }).at(0)?.hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Neue Unterkategorie' }).at(0)?.hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Löschen' }).at(0)?.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('2 Kategorien')).toBeTruthy();
  });

  it('renders an error state and retries into the empty state', async () => {
    state.listCategories.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Kategorien konnten nicht geladen werden.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    await waitFor(() => {
      expect(screen.getByText('Aktuell wurden keine Kategorien aus dem Mainserver geladen.')).toBeTruthy();
      expect(screen.getByText('Sobald Kategorien vorhanden sind, erscheinen sie hier als flache Tabelle.')).toBeTruthy();
    });
  });

  it('renders a specific guidance message for missing Mainserver credentials', async () => {
    state.listCategories.mockRejectedValueOnce(
      Object.assign(new Error('Für die aktive Organisation fehlen Mainserver-Credentials.'), {
        code: 'organization_mainserver_credentials_missing',
        name: 'CategoriesApiError',
      })
    );

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Für den aktuellen Kontext fehlen Mainserver-Zugangsdaten. Bitte wählen Sie eine Organisation mit gepflegten Mainserver-Credentials oder hinterlegen Sie persönliche Mainserver-Zugangsdaten.'
        )
      ).toBeTruthy();
    });
  });
});
