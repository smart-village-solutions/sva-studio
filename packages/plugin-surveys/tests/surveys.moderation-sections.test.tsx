import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SurveyModerationGroupCard,
  SurveyModerationPlaceholder,
  SurveyModerationResponseDialog,
} from '../src/surveys.moderation-sections.js';

const formatDateTimeInEditorTimeZoneMock = vi.fn<(value: string) => string | null>();

vi.mock('@sva/plugin-sdk', () => ({
  formatDateTimeInEditorTimeZone: (value: string) => formatDateTimeInEditorTimeZoneMock(value),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Dialog: ({
    children,
    onOpenChange,
    open,
  }: {
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
    open: boolean;
  }) => (
    <div data-open={open}>
      <button type="button" onClick={() => onOpenChange?.(true)}>
        Dialog stays open
      </button>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        Dialog closes
      </button>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  const template =
    (
      {
        'cards.moderation.title': 'Moderation',
        'cards.moderation.description': 'Moderationsbeschreibung',
        'messages.moderationEmptyQuestion': 'Keine Antworten vorhanden.',
        'fields.freeTextExcerpt': 'Freitext',
        'fields.freeTextCreatedAt': 'Eingegangen',
        'fields.freeTextStatus': 'Status',
        'fields.freeTextOpenOverlay': 'Volltext öffnen',
        'fields.freeTextOverlayText': 'Volltext',
        'fields.freeTextOverlayStatus': 'Status',
        'fields.freeTextOverlayCreatedAt': 'Zeitstempel',
        'fields.freeTextStatusOptions.internal': 'Intern',
        'fields.freeTextStatusOptions.public': 'Öffentlich',
        'labels.freeTextVisibility': 'Antwort {{index}} öffentlich sichtbar',
        'actions.closeOverlay': 'Schließen',
      } as const
    )[key] ?? key;

  if (!variables) {
    return template;
  }

  return Object.entries(variables).reduce(
    (value, [variableName, variableValue]) => value.replace(`{{${variableName}}}`, String(variableValue)),
    template
  );
};

describe('survey moderation sections', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the placeholder card', () => {
    render(<SurveyModerationPlaceholder description="Moderationsbeschreibung" message="Noch keine Daten." pt={pt} />);

    expect(screen.getByRole('heading', { name: 'Moderation' })).toBeTruthy();
    expect(screen.getByText('Noch keine Daten.')).toBeTruthy();
  });

  it('falls back to question ids and raw timestamps when formatting is unavailable', () => {
    formatDateTimeInEditorTimeZoneMock.mockReturnValue(null);

    render(
      <SurveyModerationGroupCard
        pt={pt}
        onOpenResponse={vi.fn()}
        group={{
          questionId: 'question-1',
          questionTitle: '   ',
          responses: [
            {
              id: 'response-1',
              text: 'Ein längerer Freitext für die Detailansicht.',
              status: 'PUBLIC',
              createdAt: '2026-07-01T08:00:00.000Z',
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'question-1' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'question-1' })).toBeTruthy();
    expect(screen.getByText('2026-07-01T08:00:00.000Z')).toBeTruthy();
    expect(screen.getByLabelText('Antwort 1 öffentlich sichtbar').textContent).toBe('Öffentlich');
  });

  it('renders the empty-question state without a table', () => {
    render(
      <SurveyModerationGroupCard
        pt={pt}
        onOpenResponse={vi.fn()}
        group={{
          questionId: 'question-2',
          questionTitle: 'Frage ohne Antworten',
          responses: [],
        }}
      />
    );

    expect(screen.getByText('Keine Antworten vorhanden.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps the dialog open on truthy open changes and closes it on falsy ones', () => {
    formatDateTimeInEditorTimeZoneMock.mockImplementation((value) => `formatted:${value}`);
    const onClose = vi.fn();

    render(
      <SurveyModerationResponseDialog
        pt={pt}
        onClose={onClose}
        selectedResponse={{
          id: 'response-1',
          text: 'Antworttext',
          status: 'INTERNAL',
          createdAt: '2026-07-01T08:00:00.000Z',
        }}
      />
    );

    expect(screen.getByText('Antworttext')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dialog stays open' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Dialog closes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders no dialog content when no response is selected', () => {
    render(<SurveyModerationResponseDialog pt={pt} onClose={vi.fn()} selectedResponse={null} />);

    expect(screen.queryByText('Volltext')).toBeNull();
  });
});
