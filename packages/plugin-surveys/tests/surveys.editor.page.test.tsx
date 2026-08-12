import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const submitMock = vi.fn();
const controllerState = vi.hoisted(() => ({
  isLoading: false,
  loadedItem: null as null | { status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' },
  resourceAccess: {} as Readonly<Record<string, boolean>>,
  status: null as null | { kind: 'success' | 'error'; text: string },
  onInitialSavedConsumed: undefined as undefined | (() => void),
}));
const accessState = vi.hoisted(() => ({
  snapshot: {
    isResolved: true,
    permissionActions: ['surveys.read', 'surveys.create', 'surveys.update', 'surveys.delete'],
    unscopedPermissionActions: [
      'surveys.read',
      'surveys.create',
      'surveys.update',
      'surveys.delete',
    ],
    assignedModules: ['surveys'],
    roles: [],
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: {} }),
}));

vi.mock('@sva/plugin-sdk', () => ({
  hasContentLifecycleAccess: (
    action: string | undefined,
    resourceAccess: Readonly<Record<string, boolean>>
  ) => action === undefined || resourceAccess[action] === true,
  readSessionAccessSnapshot: () => accessState.snapshot,
  resolveContentLifecycleAction: (
    currentStatus: 'draft' | 'published' | 'archived',
    nextStatus: 'draft' | 'published' | 'archived'
  ) => {
    if (currentStatus === nextStatus) return undefined;
    if (nextStatus === 'published') return 'content.publish';
    if (nextStatus === 'archived') return 'content.archive';
    return currentStatus === 'archived' ? 'content.restore' : 'content.changeStatus';
  },
  resolveStandardContentAccessCapabilities: (
    pluginId: string,
    snapshot: typeof accessState.snapshot,
    resourceAccess: Readonly<Record<string, boolean>> = {}
  ) => {
    const permits = (action: string) => {
      const actionId = `${pluginId}.${action}`;
      const scopedResourceGrant =
        (action === 'update' || action === 'delete') && resourceAccess[actionId] === true;
      return (
        snapshot.isResolved &&
        snapshot.assignedModules.includes(pluginId) &&
        snapshot.permissionActions.includes(actionId) &&
        (snapshot.unscopedPermissionActions.includes(actionId) || scopedResourceGrant)
      );
    };
    return {
      canRead: permits('read'),
      canCreate: permits('create'),
      canUpdate: permits('update'),
      canDelete: permits('delete'),
    };
  },
  subscribeSessionAccessSnapshot: () => () => undefined,
  usePluginTranslation: () => (key: string) =>
    ({
      'pages.createTitle': 'Umfrage anlegen',
      'pages.createDescription': 'Beschreibung anlegen',
      'pages.editTitle': 'Umfrage bearbeiten',
      'pages.editDescription': 'Beschreibung bearbeiten',
      'messages.editorLoading': 'Umfrage wird geladen.',
      'messages.updateUnavailable': 'Bearbeiten nicht verfügbar.',
      'tabs.ariaLabel': 'Umfrage-Bereiche',
      'tabs.basis.label': 'Basis',
      'tabs.basis.title': 'Basis',
      'tabs.basis.description': 'Basisbeschreibung',
      'tabs.content.label': 'Inhalt',
      'tabs.content.title': 'Inhalt',
      'tabs.content.description': 'Inhaltsbeschreibung',
      'tabs.moderation.label': 'Moderation',
      'tabs.moderation.title': 'Moderation',
      'tabs.moderation.description': 'Moderationsbeschreibung',
      'tabs.results.label': 'Ergebnisse',
      'tabs.results.title': 'Ergebnisse',
      'tabs.results.description': 'Ergebnisbeschreibung',
      'tabs.history.label': 'Historie',
      'tabs.history.title': 'Historie',
      'tabs.history.description': 'Historienbeschreibung',
    })[key] ?? key,
}));

vi.mock('../src/surveys.editor-logic.js', () => ({
  useSurveyEditorController: ({
    navigateToCreatedDetail,
    onInitialSavedConsumed,
  }: {
    navigateToCreatedDetail: (contentId: string) => void;
    onInitialSavedConsumed: () => void;
  }) => {
    controllerState.onInitialSavedConsumed = onInitialSavedConsumed;
    submitMock.mockImplementation(() => {
      navigateToCreatedDetail('survey-created');
    });
    return {
      isLoading: controllerState.isLoading,
      loadedItem: controllerState.loadedItem,
      resourceAccess: controllerState.resourceAccess,
      status: controllerState.status,
      submit: submitMock,
    };
  },
}));

import { SurveyEditorPage } from '../src/surveys.editor.js';

describe('SurveyEditorPage', () => {
  afterEach(() => {
    cleanup();
    controllerState.isLoading = false;
    controllerState.loadedItem = null;
    controllerState.resourceAccess = {};
    controllerState.status = null;
    controllerState.onInitialSavedConsumed = undefined;
    submitMock.mockReset();
    navigateMock.mockReset();
    accessState.snapshot = {
      isResolved: true,
      permissionActions: ['surveys.read', 'surveys.create', 'surveys.update', 'surveys.delete'],
      unscopedPermissionActions: [
        'surveys.read',
        'surveys.create',
        'surveys.update',
        'surveys.delete',
      ],
      assignedModules: ['surveys'],
      roles: [],
    };
  });

  it('renders the loading state before the editor is ready', () => {
    controllerState.isLoading = true;

    render(<SurveyEditorPage mode="edit" contentId="survey-1" />);

    expect(screen.getByText('Umfrage wird geladen.')).toBeTruthy();
  });

  it('submits through the form and renders status summaries', () => {
    controllerState.status = { kind: 'success', text: 'Umfrage wurde gespeichert.' };

    render(<SurveyEditorPage mode="create" />);

    expect(screen.getByText('Umfrage wurde gespeichert.')).toBeTruthy();

    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/surveys/$id',
        params: { id: 'survey-created' },
        state: expect.any(Function),
      })
    );

    const createNavigation = navigateMock.mock.calls.at(-1)?.[0] as {
      state: (previous: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(createNavigation.state({ preserved: true })).toEqual({
      preserved: true,
      studioSaveFeedback: {
        kind: 'created',
        resourceId: 'survey-created',
        resourceType: 'surveys',
      },
    });

    controllerState.onInitialSavedConsumed?.();
    const consumeNavigation = navigateMock.mock.calls.at(-1)?.[0] as {
      state: (previous: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(
      consumeNavigation.state({
        preserved: true,
        studioSaveFeedback: {
          kind: 'created',
          resourceId: 'survey-created',
          resourceType: 'surveys',
        },
      })
    ).toEqual({ preserved: true });
  });

  it('fails closed for scoped edits until the Mainserver grants resource access', () => {
    controllerState.loadedItem = { status: 'DRAFT' };
    accessState.snapshot = {
      ...accessState.snapshot,
      unscopedPermissionActions: accessState.snapshot.unscopedPermissionActions.filter(
        (action) => action !== 'surveys.update'
      ),
    };
    const view = render(<SurveyEditorPage mode="edit" contentId="survey-1" canUpdate />);

    expect(screen.getByText('Bearbeiten nicht verfügbar.')).toBeTruthy();
    expect(
      [
        ...view.container.querySelectorAll<HTMLButtonElement>('button[form="survey-detail-form"]'),
      ].every((button) => button.disabled)
    ).toBe(true);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();

    controllerState.resourceAccess = { 'surveys.update': true };
    view.rerender(<SurveyEditorPage mode="edit" contentId="survey-1" canUpdate />);
    expect(
      [
        ...view.container.querySelectorAll<HTMLButtonElement>('button[form="survey-detail-form"]'),
      ].every((button) => !button.disabled)
    ).toBe(true);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it('keeps editing disabled when the confirmed Mainserver capability is unavailable', () => {
    controllerState.resourceAccess = { 'surveys.update': true };

    const view = render(<SurveyEditorPage mode="edit" contentId="survey-1" canUpdate={false} />);

    expect(screen.getByText('Bearbeiten nicht verfügbar.')).toBeTruthy();
    expect(
      [
        ...view.container.querySelectorAll<HTMLButtonElement>('button[form="survey-detail-form"]'),
      ].every((button) => button.disabled)
    ).toBe(true);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('fails closed when the surveys module or matching action is missing', () => {
    accessState.snapshot = {
      isResolved: true,
      permissionActions: ['surveys.create'],
      unscopedPermissionActions: ['surveys.create'],
      assignedModules: [],
      roles: [],
    };
    const view = render(<SurveyEditorPage mode="create" />);

    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();

    accessState.snapshot = {
      isResolved: true,
      permissionActions: ['surveys.read'],
      unscopedPermissionActions: ['surveys.read'],
      assignedModules: ['surveys'],
      roles: [],
    };
    view.rerender(<SurveyEditorPage mode="create" />);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();
  });
});
