import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  access: {
    isResolved: true,
    assignedModules: ['categories'],
    permissionActions: [
      'categories.read',
      'categories.create',
      'categories.update',
      'categories.delete',
    ],
    roles: [],
  },
}));

vi.mock('../src/categories.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/categories.api.js')>(
    '../src/categories.api.js'
  );
  return {
    ...actual,
    deleteCategory: state.remove,
    listCategoryManagement: state.list,
    saveCategory: state.save,
  };
});

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    readSessionAccessSnapshot: () => state.access,
    subscribeSessionAccessSnapshot: () => () => undefined,
  };
});

import { CategoriesPage } from '../src/categories.pages.js';
import { initialDraft, normalizeDraft } from '../src/categories.page-support.js';

const categories = [
  {
    id: 'cat-root',
    name: 'Service',
    active: true,
    position: 1,
    children: [{ id: 'cat-child' }],
    dataTypes: ['news_item'],
  },
  {
    id: 'cat-child',
    name: 'Bürgerbüro',
    active: true,
    children: [],
    dataTypes: [],
    parent: { id: 'cat-root', name: 'Service' },
  },
] as const;

const label = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  const labels: Record<string, string> = {
    'categories.list.title': 'Kategorien',
    'categories.list.description': 'Kategorien verwalten',
    'categories.fields.actions': 'Aktionen',
    'categories.fields.status': 'Status',
    'categories.fields.name': 'Name',
    'categories.fields.hierarchy': 'Hierarchie',
    'categories.fields.position': 'Position',
    'categories.fields.parent': 'Übergeordnete Kategorie',
    'categories.fields.icon': 'Icon',
    'categories.fields.email': 'E-Mail',
    'categories.fields.dataTypes': 'Datentypen',
    'categories.fields.active': 'Aktiv',
    'categories.values.active': 'Aktiv',
    'categories.values.inactive': 'Inaktiv',
    'categories.values.notAvailable': '—',
    'categories.values.root': 'Keine übergeordnete Kategorie',
    'categories.actions.edit': 'Bearbeiten',
    'categories.actions.createChild': 'Neue Unterkategorie',
    'categories.actions.create': 'Kategorie anlegen',
    'categories.actions.save': 'Speichern',
    'categories.actions.saving': 'Wird gespeichert',
    'categories.actions.cancel': 'Abbrechen',
    'categories.actions.delete': 'Löschen',
    'categories.actions.reload': 'Erneut laden',
    'categories.messages.loading': 'Kategorien werden geladen.',
    'categories.messages.loadError': 'Kategorien konnten nicht geladen werden.',
    'categories.messages.mutationActionsLoading': 'Schreibaktionen werden geprüft.',
    'categories.messages.mutationActionsLoadError': 'Schreibaktionen konnten nicht geprüft werden.',
    'categories.messages.nameRequired': 'Bitte geben Sie einen Kategorienamen an.',
    'categories.messages.nameTaken': 'Dieser Kategoriename ist bereits vergeben.',
    'categories.messages.invalidParent': 'Die übergeordnete Kategorie ist ungültig.',
    'categories.messages.categoryNotFound': 'Die Kategorie ist nicht mehr vorhanden.',
    'categories.messages.positionInvalid': 'Position ungültig.',
    'categories.messages.iconInvalid': 'Icon ungültig.',
    'categories.messages.dataTypeInvalid': 'Datentyp ungültig.',
    'categories.messages.createForbidden': 'categories.create fehlt.',
    'categories.messages.updateForbidden': 'categories.update fehlt.',
    'categories.messages.deleteForbidden': 'categories.delete fehlt.',
    'categories.messages.savedReloadFailed': 'Gespeichert, aber Neuladen fehlgeschlagen.',
    'categories.messages.saved': 'Die Kategorie wurde gespeichert.',
    'categories.messages.deleted': 'Die Kategorie wurde gelöscht.',
    'categories.messages.deleteBlocked': 'Löschen blockiert.',
    'categories.empty.title': 'Keine Kategorien',
    'categories.empty.description': 'Noch keine Kategorien vorhanden.',
    'categories.table.ariaLabel': 'Kategorien-Tabelle',
    'categories.table.caption': 'Kategorien',
    'categories.form.createTitle': 'Kategorie anlegen',
    'categories.form.editTitle': 'Kategorie bearbeiten',
    'categories.form.description': 'Kategoriedaten',
    'categories.deleteDialog.title': 'Kategorie löschen',
    'categories.deleteDialog.confirm': 'Kategorie löschen',
    'categories.deleteDialog.pending': 'Kategorie wird gelöscht',
    'categories.deleteDialog.usage.children': 'Unterkategorien',
    'categories.deleteDialog.usage.resourceAssignments': 'Inhaltszuordnungen',
    'categories.deleteDialog.usage.externalServiceAssignments': 'Externe Dienste',
    'categories.deleteDialog.usage.dataResourceSettings': 'Datenquellen',
    'categories.deleteDialog.usage.notificationConfigurations': 'Benachrichtigungen',
    'categories.cascadeDialog.title': 'Statusänderung bestätigen',
    'categories.cascadeDialog.confirm': 'Status ändern',
  };
  if (key === 'categories.table.countLabel') return `${variables?.count ?? 0} Kategorien`;
  if (key === 'categories.deleteDialog.description') return `${variables?.target ?? ''} löschen?`;
  if (key === 'categories.cascadeDialog.description')
    return `${variables?.count ?? 0} Unterkategorien betroffen`;
  if (key === 'categories.messages.savedWithDescendants')
    return `${variables?.count ?? 0} Unterkategorien gespeichert`;
  return labels[key] ?? key;
};

const createCategory = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Kategorie anlegen' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
};

describe('CategoriesPage', () => {
  beforeEach(() => {
    state.list.mockReset().mockResolvedValue(categories);
    state.save.mockReset();
    state.remove.mockReset();
    registerPluginTranslationResolver(label);
  });

  afterEach(cleanup);

  it('renders the management table and enables actions from their distinct permissions', async () => {
    render(<CategoriesPage />);
    expect(screen.getByText('Kategorien werden geladen.')).toBeTruthy();
    expect(await screen.findByRole('table', { name: 'Kategorien-Tabelle' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]?.hasAttribute('disabled')).toBe(
      false
    );
    expect(
      screen.getAllByRole('button', { name: 'Neue Unterkategorie' })[0]?.hasAttribute('disabled')
    ).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Löschen' })[0]?.hasAttribute('disabled')).toBe(
      false
    );
  });

  it('edits optional fields and creates a child category from the table action', async () => {
    state.save.mockResolvedValue({
      category: { ...categories[1], id: 'cat-new' },
      affectedDescendantIds: [],
      errors: [],
    });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Neue Unterkategorie' })[0]!);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neue Unterkategorie' } });
    fireEvent.change(screen.getByLabelText('Übergeordnete Kategorie'), {
      target: { value: 'cat-child' },
    });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'team@example.org' } });
    const dataTypes = screen.getByLabelText('Datentypen') as HTMLSelectElement;
    const eventRecord = Array.from(dataTypes.options).find(
      (option) => option.value === 'event_record'
    );
    if (!eventRecord) throw new Error('Expected event record option');
    eventRecord.selected = true;
    fireEvent.change(dataTypes);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          category: expect.objectContaining({
            parentId: 'cat-child',
            position: null,
            email: 'team@example.org',
            dataTypes: ['event_record'],
          }),
        })
      )
    );
  });

  it('renders inactive category status in the management table', async () => {
    state.list.mockResolvedValue([{ ...categories[0], active: false }]);
    render(<CategoriesPage />);

    expect((await screen.findAllByText('Inaktiv')).length).toBeGreaterThan(0);
  });

  it('intersects mutation permissions with confirmed Mainserver capabilities', async () => {
    render(<CategoriesPage enabledMutationActions={['categories.update']} />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    expect(screen.queryByRole('button', { name: 'Kategorie anlegen' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]?.hasAttribute('disabled')).toBe(
      false
    );
    expect(
      screen.getAllByRole('button', { name: 'Neue Unterkategorie' })[0]?.hasAttribute('disabled')
    ).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Löschen' })[0]?.hasAttribute('disabled')).toBe(
      true
    );
  });

  it('keeps mutations fail-closed and exposes a retry when capabilities cannot be loaded', async () => {
    const reloadMutationActions = vi.fn();
    render(
      <CategoriesPage
        enabledMutationActions={[]}
        mutationActionsError
        onReloadMutationActions={reloadMutationActions}
      />
    );
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    expect(screen.getByText('Schreibaktionen konnten nicht geprüft werden.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kategorie anlegen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
    expect(reloadMutationActions).toHaveBeenCalledTimes(1);
  });

  it('reuses the create idempotency key when the same attempt is retried', async () => {
    state.save.mockRejectedValue(new Error('response lost'));
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    createCategory();
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    await screen.findByText('Kategorien konnten nicht geladen werden.');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu geändert' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));

    expect(state.save.mock.calls[0]?.[0].idempotencyKey).toBe(
      state.save.mock.calls[1]?.[0].idempotencyKey
    );
    expect(state.save.mock.calls[1]?.[0].category.name).toBe('Neu geändert');
  });

  it('starts a new create attempt after a terminal structured failure', async () => {
    state.save
      .mockResolvedValueOnce({
        affectedDescendantIds: [],
        errors: [{ code: 'CATEGORY_NAME_TAKEN', field: 'name', message: 'Name vergeben' }],
      })
      .mockResolvedValueOnce({
        category: { ...categories[0], id: 'cat-new' },
        affectedDescendantIds: [],
        errors: [],
      });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    createCategory();
    await screen.findByText('Dieser Kategoriename ist bereits vergeben.');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));

    expect(state.save.mock.calls[0]?.[0].idempotencyKey).not.toBe(
      state.save.mock.calls[1]?.[0].idempotencyKey
    );
  });

  it('reloads the management snapshot after an indeterminate update result', async () => {
    state.save.mockRejectedValue(new Error('response lost'));
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.list).toHaveBeenCalledTimes(2));
  });

  it('requires an explicit confirmation before changing a parent status', async () => {
    state.save.mockResolvedValue({
      category: categories[0],
      affectedDescendantIds: ['cat-child'],
      errors: [],
    });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]!);
    fireEvent.click(screen.getByLabelText('Aktiv'));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(state.save).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Statusänderung bestätigen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Status ändern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
  });

  it('associates local and upstream validation errors with their fields', async () => {
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie anlegen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('true');
    expect(state.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Doppelt' } });
    state.save.mockResolvedValue({
      affectedDescendantIds: [],
      errors: [{ code: 'CATEGORY_NAME_TAKEN', field: 'name', message: 'Name vergeben' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Dieser Kategoriename ist bereits vergeben.')).toBeTruthy();
    expect(screen.getByLabelText('Name').getAttribute('aria-describedby')).toBe(
      'category-name-error'
    );
  });

  it('rejects positions outside GraphQL Int and malformed icon names before saving', async () => {
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie anlegen' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu' } });
    const position = screen.getByLabelText('Position');
    expect(position.getAttribute('max')).toBe('2147483647');
    fireEvent.change(position, { target: { value: '2147483648' } });
    fireEvent.change(screen.getByLabelText('Icon'), { target: { value: 'invalid icon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.getByText('Position ungültig.')).toBeTruthy();
    expect(screen.getByText('Icon ungültig.')).toBeTruthy();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('accepts the maximum position and consumer-supported icon forms', async () => {
    state.save.mockResolvedValue({
      category: { ...categories[0], id: 'cat-new' },
      affectedDescendantIds: [],
      errors: [],
    });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie anlegen' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu' } });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: '2147483647' } });
    fireEvent.change(screen.getByLabelText('Icon'), {
      target: { value: 'https://icons.example.test/town-hall.svg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          category: expect.objectContaining({
            position: 2_147_483_647,
            iconName: 'https://icons.example.test/town-hall.svg',
          }),
        })
      )
    );
  });

  it('rejects invalid data type identifiers before saving', () => {
    const result = normalizeDraft(
      { ...initialDraft(), name: 'Neu', dataTypes: ['invalid value'] },
      (key, variables) => label(`categories.${key}`, variables)
    );

    expect(result.errors.dataTypes).toBe('Datentyp ungültig.');
  });

  it('localizes forbidden category mutations for their attempted actions', async () => {
    state.save.mockRejectedValueOnce({ code: 'forbidden' }).mockRejectedValueOnce({
      code: 'forbidden',
    });
    state.remove.mockRejectedValue({ code: 'forbidden' });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });

    createCategory();
    expect(await screen.findByText('categories.create fehlt.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    const editButton = screen.getAllByRole('button', { name: 'Bearbeiten' })[0];
    if (!editButton) throw new Error('Expected an edit button');
    fireEvent.click(editButton);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('categories.update fehlt.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    const deleteButton = screen.getAllByRole('button', { name: 'Löschen' })[0];
    if (!deleteButton) throw new Error('Expected a delete button');
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie löschen' }));
    expect(await screen.findByText('categories.delete fehlt.')).toBeTruthy();
  });

  it('shows all returned usage counts when safe-delete is blocked', async () => {
    state.remove.mockResolvedValue({
      usage: {
        children: 1,
        resourceAssignments: 2,
        externalServiceAssignments: 3,
        dataResourceSettings: 4,
        notificationConfigurations: 5,
      },
      errors: [{ code: 'CATEGORY_IN_USE', message: 'In Verwendung' }],
    });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie löschen' }));

    expect(await screen.findByText('Löschen blockiert.')).toBeTruthy();
    for (const value of [
      'Unterkategorien',
      'Inhaltszuordnungen',
      'Externe Dienste',
      'Datenquellen',
      'Benachrichtigungen',
    ])
      expect(screen.getByText(value)).toBeTruthy();
  });

  it('closes an indeterminate delete after the authoritative reread no longer contains it', async () => {
    state.list
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce(categories.filter((category) => category.id !== 'cat-root'));
    state.remove.mockRejectedValue(new Error('response lost'));
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie löschen' }));

    await waitFor(() => expect(state.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog', { name: 'Kategorie löschen' })).toBeNull();
    expect(screen.getByText('Die Kategorie wurde gelöscht.')).toBeTruthy();
  });

  it('keeps confirmed save success distinct from a failed management reload', async () => {
    state.list.mockResolvedValueOnce(categories).mockRejectedValueOnce(new Error('reload failed'));
    state.save.mockResolvedValue({
      category: { ...categories[0], id: 'cat-new' },
      affectedDescendantIds: [],
      errors: [],
    });
    render(<CategoriesPage />);
    await screen.findByRole('table', { name: 'Kategorien-Tabelle' });
    createCategory();

    expect(await screen.findByText('Gespeichert, aber Neuladen fehlgeschlagen.')).toBeTruthy();
    expect(screen.getByText('Kategorien konnten nicht geladen werden.')).toBeTruthy();
  });
});
