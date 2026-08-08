import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const submitMock = vi.fn();
const controllerState = vi.hoisted(() => ({
  isLoading: false,
  loadedItem: null,
  status: null as null | { kind: 'success' | 'error'; text: string },
}));
const accessState = vi.hoisted(() => ({
  snapshot: {
    isResolved: true,
    permissionActions: ['surveys.read', 'surveys.create', 'surveys.update', 'surveys.delete'],
    assignedModules: ['surveys'],
    roles: [],
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  readSessionAccessSnapshot: () => accessState.snapshot,
  resolveStandardContentAccessCapabilities: (
    pluginId: string,
    snapshot: typeof accessState.snapshot
  ) => {
    const permits = (action: string) =>
      snapshot.isResolved &&
      snapshot.assignedModules.includes(pluginId) &&
      snapshot.permissionActions.includes(`${pluginId}.${action}`);
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
  useSurveyEditorController: ({ navigateToContentList }: { navigateToContentList: () => void }) => {
    submitMock.mockImplementation(() => {
      navigateToContentList();
    });
    return {
      isLoading: controllerState.isLoading,
      loadedItem: controllerState.loadedItem,
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
    controllerState.status = null;
    submitMock.mockReset();
    navigateMock.mockReset();
    accessState.snapshot = {
      isResolved: true,
      permissionActions: ['surveys.read', 'surveys.create', 'surveys.update', 'surveys.delete'],
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
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
  });

  it('fails closed for edits until the Mainserver update capability is enabled', () => {
    const view = render(<SurveyEditorPage mode="edit" contentId="survey-1" />);

    expect(screen.getByText('Bearbeiten nicht verfügbar.')).toBeTruthy();
    expect(
      [
        ...view.container.querySelectorAll<HTMLButtonElement>('button[form="survey-detail-form"]'),
      ].every((button) => button.disabled)
    ).toBe(true);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();

    view.rerender(<SurveyEditorPage mode="edit" contentId="survey-1" canUpdate />);
    expect(
      [
        ...view.container.querySelectorAll<HTMLButtonElement>('button[form="survey-detail-form"]'),
      ].every((button) => !button.disabled)
    ).toBe(true);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the surveys module or matching action is missing', () => {
    accessState.snapshot = {
      isResolved: true,
      permissionActions: ['surveys.create'],
      assignedModules: [],
      roles: [],
    };
    const view = render(<SurveyEditorPage mode="create" />);

    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();

    accessState.snapshot = {
      isResolved: true,
      permissionActions: ['surveys.read'],
      assignedModules: ['surveys'],
      roles: [],
    };
    view.rerender(<SurveyEditorPage mode="create" />);
    fireEvent.submit(document.getElementById('survey-detail-form') as HTMLFormElement);
    expect(submitMock).not.toHaveBeenCalled();
  });
});
