import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { SurveyDetailBasisTab } from '../src/surveys.detail-basis-tab.js';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from '../src/surveys.detail-form.js';

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  const template = ({
    'cards.basis.identity.title': 'Identität',
    'cards.basis.identity.description': 'Titel und Status der Umfrage.',
    'cards.basis.schedule.title': 'Laufzeit',
    'cards.basis.schedule.description': 'Start- und Endzeitraum der Umfrage.',
    'cards.basis.targetArea.title': 'Zielgebiet',
    'cards.basis.targetArea.description': 'Optionale Zielgebiete für die Umfrage.',
    'cards.basis.metadata.title': 'Metadaten',
    'cards.basis.metadata.description': 'Zeitliche Metadaten der Umfrage.',
    'fields.title': 'Titel',
    'fields.status': 'Status',
    'fields.startAt': 'Start',
    'fields.endAt': 'Ende',
    'fields.targetAreas': 'Zielgebiete',
    'fields.targetAreasSearch': 'Zielgebiet suchen',
    'fields.targetAreasSearchPlaceholder': 'Zielgebiet auswählen',
    'fields.createdAt': 'Erstellt',
    'fields.updatedAt': 'Aktualisiert',
    'fields.publishedAt': 'Veröffentlicht',
    'fields.archivedAt': 'Archiviert',
    'fields.statusOptions.draft': 'Entwurf',
    'fields.statusOptions.active': 'Aktiv',
    'fields.statusOptions.archived': 'Archiviert',
    'messages.unlimitedScheduleHint': 'Ohne Enddatum bleibt die Umfrage unbefristet.',
    'messages.targetAreasEmpty': 'Es stehen derzeit keine Zielgebiete zur Auswahl.',
    'messages.metadataCreateHint': 'Metadaten erscheinen nach dem ersten Speichern der Umfrage.',
    'actions.addTargetArea': 'Zielgebiet hinzufügen',
    'actions.removeTargetArea': 'Zielgebiet {{name}} entfernen',
  })[key] ?? key;

  if (!variables) {
    return template;
  }

  return Object.entries(variables).reduce(
    (value, [variableName, variableValue]) => value.replace(`{{${variableName}}}`, String(variableValue)),
    template
  );
};

function renderTab({
  mode = 'create',
  loadedItem = null,
  defaultValues,
}: Readonly<{
  mode?: 'create' | 'edit';
  loadedItem?: {
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;
    archivedAt?: string;
  } | null;
  defaultValues?: Partial<SurveyDetailFormValues>;
}> = {}) {
  const Wrapper = () => {
    const methods = useForm<SurveyDetailFormValues>({
      defaultValues: {
        ...createDefaultSurveyDetailFormValues(),
        ...defaultValues,
      },
    });

    return (
      <FormProvider {...methods}>
        <SurveyDetailBasisTab
          mode={mode}
          loadedItem={loadedItem}
          availableTargetAreas={[
            { id: 'area-1', label: 'Innenstadt' },
            { id: 'area-2', label: 'Nordstadt' },
          ]}
          pt={pt}
        />
      </FormProvider>
    );
  };

  return render(<Wrapper />);
}

describe('SurveyDetailBasisTab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders identity and schedule fields plus the unlimited schedule hint', () => {
    const view = renderTab();
    const scoped = within(view.container);

    expect(scoped.getByLabelText('Titel')).toBeTruthy();
    expect(scoped.getByLabelText('Status')).toBeTruthy();
    expect(scoped.getByLabelText('Start')).toBeTruthy();
    expect(scoped.getByLabelText('Ende')).toBeTruthy();
    expect(scoped.getByText('Ohne Enddatum bleibt die Umfrage unbefristet.')).toBeTruthy();
  });

  it('adds and removes target areas through the multiselect-style control', () => {
    const view = renderTab();
    const scoped = within(view.container);

    fireEvent.change(scoped.getByLabelText('Zielgebiet suchen'), { target: { value: 'area-1' } });
    expect(scoped.getByRole('button', { name: 'Zielgebiet Innenstadt entfernen' })).toBeTruthy();

    fireEvent.click(scoped.getByRole('button', { name: 'Zielgebiet Innenstadt entfernen' }));
    expect(scoped.queryByRole('button', { name: 'Zielgebiet Innenstadt entfernen' })).toBeNull();
  });

  it('shows a create hint instead of metadata values before the first save', () => {
    const view = renderTab();
    const scoped = within(view.container);

    expect(scoped.getByText('Metadaten erscheinen nach dem ersten Speichern der Umfrage.')).toBeTruthy();
    expect(scoped.queryByText('Erstellt')).toBeNull();
  });

  it('renders metadata values in edit mode', () => {
    const view = renderTab({
      mode: 'edit',
      loadedItem: {
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-02T09:30:00.000Z',
        publishedAt: '2026-07-03T10:15:00.000Z',
      },
    });
    const scoped = within(view.container);

    expect(scoped.getByText('Erstellt')).toBeTruthy();
    expect(scoped.getByText('Aktualisiert')).toBeTruthy();
    expect(scoped.getByText('Veröffentlicht')).toBeTruthy();
  });
});
