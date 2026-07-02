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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) =>
    ({
      'pages.createTitle': 'Umfrage anlegen',
      'pages.createDescription': 'Beschreibung anlegen',
      'pages.editTitle': 'Umfrage bearbeiten',
      'pages.editDescription': 'Beschreibung bearbeiten',
      'messages.editorLoading': 'Umfrage wird geladen.',
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

vi.mock('../src/surveys.editor.controller.js', () => ({
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
});
