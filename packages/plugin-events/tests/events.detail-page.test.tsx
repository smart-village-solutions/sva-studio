import { StudioEditorLeaveGuardProvider } from '@sva/studio-ui-react';
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render as testingRender,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  getHostMediaAsset,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  publishSessionAccessSnapshot,
  registerPluginTranslationResolver,
  resetSessionAccessSnapshot,
  saveContentWithHostMediaReferences,
  updateHostMediaAsset,
  uploadHostMediaFile,
} from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEvent,
  EventsApiError,
  deleteEvent,
  getEvent,
  getEventDetail,
  listEventCategories,
  listPoiForEventSelection,
  updateEvent,
} from '../src/events.api.js';

import { EventsDetailPage } from '../src/events.detail-page.js';

const navigateMock = vi.fn();
const leaveChecks = new Set<() => boolean>();
const hasUnsavedChanges = () => [...leaveChecks].some((check) => check());
const registerLeaveCheck = (check: () => boolean) => {
  leaveChecks.add(check);
  return () => {
    leaveChecks.delete(check);
  };
};
const render = (element: React.ReactElement) =>
  testingRender(
    <StudioEditorLeaveGuardProvider register={registerLeaveCheck}>
      {element}
    </StudioEditorLeaveGuardProvider>
  );
const openEventExtras = () => {
  document.querySelectorAll('details').forEach((element) => {
    if (!element.open) fireEvent.click(element.querySelector('summary')!);
  });
};
vi.mock('../src/events.api.js', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  EventsApiError: class EventsApiError extends Error {
    constructor(
      public readonly code: string,
      message = code
    ) {
      super(message);
    }
  },
  getEvent: vi.fn(),
  getEventDetail: vi.fn(),
  listEventCategories: vi.fn(async () => []),
  listEvents: vi.fn(),
  listPoiForEventSelection: vi.fn(async () => []),
  updateEvent: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    getHostMediaAsset: vi.fn(),
    getHostMediaDelivery: vi.fn(async () => ({
      deliveryUrl: 'https://example.com/uploaded-event.jpg',
      expiresAt: '2099-01-01T00:00:00.000Z',
      isPublicUrl: true,
    })),
    listHostMediaAssets: vi.fn(async () => []),
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    saveContentWithHostMediaReferences: vi.fn(),
    updateHostMediaAsset: vi.fn(),
    uploadHostMediaFile: vi.fn(),
  };
});

vi.mock('@sva/studio-ui-react', async () => {
  const actual =
    await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      value,
      onChange,
      labelId,
      describedBy,
      ariaInvalid,
    }: {
      id: string;
      value: string;
      onChange: (nextValue: string) => void;
      labelId?: string;
      describedBy?: string;
      ariaInvalid?: boolean;
    }) => (
      <textarea
        id={id}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ? 'true' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
    >
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: {} }),
}));

describe('EventsDetailPage', () => {
  beforeEach(() => {
    leaveChecks.clear();
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: [
        'events.read',
        'events.create',
        'events.update',
        'events.delete',
        'media.read',
        'media.create',
        'media.update',
        'media.reference.manage',
      ],
      unscopedPermissionActions: ['events.read', 'events.create', 'events.update', 'events.delete'],
      assignedModules: ['events'],
      roles: [],
    });
    navigateMock.mockReset();
    vi.mocked(createEvent).mockReset();
    vi.mocked(deleteEvent).mockReset();
    vi.mocked(getEvent).mockReset();
    vi.mocked(getEventDetail).mockReset();
    vi.mocked(getEventDetail).mockImplementation(async (contentId) => ({
      data: await vi.mocked(getEvent)(contentId),
      deviations: [],
    }));
    vi.mocked(listEventCategories).mockReset();
    vi.mocked(listEventCategories).mockResolvedValue([] as never);
    vi.mocked(listPoiForEventSelection).mockReset();
    vi.mocked(listPoiForEventSelection).mockResolvedValue([] as never);
    vi.mocked(updateEvent).mockReset();
    vi.mocked(getHostMediaAsset).mockReset();
    vi.mocked(listHostMediaAssets).mockReset();
    vi.mocked(listHostMediaAssets).mockResolvedValue([] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockReset();
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([]);
    vi.mocked(saveContentWithHostMediaReferences).mockImplementation(async (input) => ({
      status: 'complete',
      saved: await input.saveContent(),
    }));
    vi.mocked(updateHostMediaAsset).mockReset();
    vi.mocked(uploadHostMediaFile).mockReset();
    vi.unstubAllGlobals();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'events.create.optional': 'optional',
        'events.create.filled': 'Angaben vorhanden',
        'events.create.empty': 'Noch keine Angaben',
        'events.create.createVisible': 'Sichtbar anlegen',
        'events.create.createHidden': 'Nicht sichtbar anlegen',
        'events.detail.createTitle': 'Event anlegen',
        'events.detail.editTitle': 'Event bearbeiten',
        'events.actions.save': 'Speichern',
        'events.messages.mediaReferenceLoadError': 'Medienreferenzen konnten nicht geladen werden.',
        'events.messages.degradedDataWarning':
          'Einige Datenbereiche konnten nicht vollständig gelesen werden.',
        'events.messages.degradedField': 'Betroffener Bereich',
        'events.actions.delete': 'Löschen',
        'events.detailTabs.basis.title': 'Basis',
        'events.detailTabs.content.title': 'Inhalt',
        'events.detailTabs.settings.title': 'Einstellungen',
        'events.detailTabs.history.title': 'Historie',
        'events.tabs.mobileLabel': 'Bereich',
        'events.tabs.ariaLabel': 'Bereiche',
        'events.cards.basis.identity.title': 'Titel & Kategorie',
        'events.cards.basis.recurrence.title': 'Serien-Logik',
        'events.cards.basis.relations.title': 'Verknüpfungen',
        'events.cards.content.media.title': 'Medien',
        'events.cards.content.dates.title': 'Termine',
        'events.cards.content.addresses.title': 'Veranstaltungsort',
        'events.cards.content.organizer.title': 'Veranstalter',
        'events.cards.content.contacts.title': 'Ansprechpartner',
        'events.cards.content.links.title': 'Links',
        'events.cards.content.prices.title': 'Preise',
        'events.cards.content.accessibility.title': 'Barrierefreiheit',
        'events.cards.settings.publication.title': 'Sichtbarkeit',
        'events.cards.settings.technical.title': 'Technische Zusatzdaten',
        'events.fields.title': 'Titel',
        'events.fields.categories': 'Kategorien',
        'events.fields.categoriesHelp': 'Mehrfachauswahl',
        'events.fields.categoriesSearch': 'Kategorien suchen',
        'events.fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswählen',
        'events.fields.url': 'URL',
        'events.fields.dateStart': 'Startdatum',
        'events.fields.dateEnd': 'Enddatum',
        'events.fields.repeat': 'Wiederholung',
        'events.fields.visible': 'Sichtbar',
        'events.fields.externalId': 'Externe ID',
        'events.fields.pointOfInterestId': 'Zugehöriger POI',
        'events.fields.pointOfInterestSearch': 'POI suchen',
        'events.fields.pointOfInterestSearchPlaceholder': 'POI suchen oder auswählen',
        'events.fields.recurringType': 'Wiederholungstyp',
        'events.fields.recurringTypePlaceholder': 'Bitte auswählen',
        'events.fields.recurringTypeOptions.days': 'Tage',
        'events.fields.recurringTypeOptions.weeks': 'Wochen',
        'events.fields.recurringTypeOptions.months': 'Monate',
        'events.fields.recurringTypeOptions.years': 'Jahre',
        'events.fields.mediaCaption': 'Bildunterschrift',
        'events.fields.mediaSourceUrl': 'Medien-URL',
        'events.fields.mediaSourceDescription': 'Medien-Beschreibung',
        'events.fields.mediaCopyright': 'Copyright',
        'events.fields.mediaContentType': 'Medientyp',
        'events.fields.mediaWidth': 'Breite',
        'events.fields.mediaHeight': 'Höhe',
        'events.fields.organizerName': 'Institution/Firma',
        'events.fields.latitude': 'Breitengrad',
        'events.fields.longitude': 'Längengrad',
        'events.fields.email': 'E-Mail',
        'events.fields.phone': 'Telefon',
        'events.fields.imageSearch': 'Bild suchen',
        'events.messages.validationError': 'Bitte Eingaben prüfen.',
        'events.validation.organizerName':
          'Geben Sie einen Namen für den Veranstalter ein oder entfernen Sie die übrigen Veranstalterangaben.',
        'events.validation.geoLocation':
          'Koordinaten müssen gültige Breiten- und Längengrade sein.',
        'events.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'events.messages.poiOptionsLoading': 'POI werden geladen.',
        'events.messages.poiOptionsEmpty': 'Keine passenden POI gefunden.',
        'events.messages.imagePickerEmpty': 'Keine passenden Medien gefunden.',
        'events.messages.mediaPickerTitle': 'Medium hinzufügen',
        'events.messages.mediaPickerLibraryAction': 'Medium aus der Bibliothek hinzufügen',
        'events.messages.mediaPickerLinkAction': 'Medium per Link hinzufügen',
        'events.messages.mediaPickerDescription':
          'Wählen Sie ein vorhandenes Medium aus oder laden Sie ein neues Bild hoch.',
        'events.messages.mediaPickerReviewMode': 'Prüfen',
        'events.messages.mediaPickerUploadRegionLabel': 'Bilddatei hochladen',
        'events.messages.mediaPickerUploadTitle': 'Neues Medium hochladen',
        'events.messages.mediaPickerUploadDescription':
          'Laden Sie ein Bild hoch und prüfen Sie danach die Metadaten vor der Übernahme.',
        'events.messages.mediaPickerSelectFile': 'Datei auswählen',
        'events.messages.mediaPickerUploadSupportLabel': 'Unterstützt werden JPG, PNG und WebP.',
        'events.messages.mediaPickerReviewTitle': 'Metadaten prüfen',
        'events.messages.mediaPickerReviewDescription':
          'Ergänzen Sie Titel, Alternativtext und weitere Metadaten, bevor das Medium übernommen wird.',
        'events.messages.mediaPickerAltText': 'Alternativtext',
        'events.messages.mediaPickerLicense': 'Lizenz',
        'events.messages.mediaPickerBackToLibrary': 'Zurück zur Mediathek',
        'events.messages.mediaPickerBackToUpload': 'Zurück zum Upload',
        'events.messages.mediaPickerOpenMediaManagement': 'In Medienverwaltung öffnen',
        'events.messages.mediaPickerUseMedia': 'Medium übernehmen',
        'events.messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
        'events.messages.mediaUploadUploading': 'Medium wird hochgeladen.',
        'events.messages.mediaUploadFinalizing': 'Medium wird verarbeitet.',
        'events.messages.mediaUploadSuccess': 'Medium wurde hinzugefügt.',
        'events.messages.mediaUploadError': 'Medium konnte nicht hochgeladen werden.',
        'events.messages.mediaUploadUnsupportedType': 'Dateityp wird nicht unterstützt.',
        'events.messages.mediaUploadUnavailableUrl': 'Bild-URL konnte nicht ermittelt werden.',
        'events.history.empty.title': 'Noch keine Historie verfügbar.',
        'events.history.createHint':
          'Speichern Sie die Veranstaltung, bevor die Historie verfügbar ist.',
        'events.messages.updateSuccess': 'Event aktualisiert.',
        'events.messages.deleteError': 'Event konnte nicht gelöscht werden.',
        'events.messages.deleteSuccess': 'Event wurde gelöscht.',
        'events.messages.deleteNavigationError':
          'Event wurde gelöscht, aber die Inhaltsliste konnte nicht geöffnet werden.',
        'events.actions.deleteConfirmTitle': 'Veranstaltung löschen?',
        'events.actions.deleteConfirm': 'Die Veranstaltung „{{title}}“ wird endgültig gelöscht.',
        'events.actions.back': 'Zurück zur Liste',
        'events.actions.addCategory': 'Kategorie hinzufügen',
        'events.actions.addImage': 'Aus Mediathek auswählen',
        'events.actions.uploadMedia': 'Medium hochladen',
        'events.actions.uploadingMedia': 'Medium wird hochgeladen',
        'events.actions.addMediaManual': 'Manuell hinzufügen',
        'events.actions.selectImage': 'Auswählen',
        'events.actions.removeImage': 'Medium entfernen',
        'events.actions.removeCategory': 'Kategorie {{name}} entfernen',
        'events.actions.clearPoiSelection': 'Auswahl löschen',
        'events.values.mediaContentTypes.unspecified': 'Nicht gesetzt',
        'events.values.mediaContentTypes.image': 'Bild',
      };

      return labels[key] ?? key;
    });
  });

  afterEach(() => {
    cleanup();
    resetSessionAccessSnapshot();
  });

  it.each([false, true])(
    'leave guard retains partial saves and only acknowledges unchanged retry drafts (%s)',
    async (editAfterPartial) => {
      vi.mocked(createEvent).mockResolvedValueOnce({
        id: 'event-created',
        title: 'Draft event',
      } as never);
      const retry = vi.fn(async () => undefined);
      vi.mocked(saveContentWithHostMediaReferences).mockImplementationOnce(async (input) => {
        const draftId = input.drafts?.[0]?.draftId;
        if (!draftId) throw new Error('missing test media draft');
        const resolutions = [
          { draftId, assetId: 'asset-uploaded', persistentUrl: 'https://example.com/uploaded.jpg' },
        ];
        return {
          status: 'reference_failed',
          saved: await input.saveContent(resolutions),
          resolutions,
          retryReferenceSync: retry,
        };
      });
      render(<EventsDetailPage mode="create" />);
      fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Draft event' } });
      fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
      fireEvent.change(screen.getByTestId('media-upload-input'), {
        target: { files: [new File(['image'], 'draft.jpg', { type: 'image/jpeg' })] },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Medium übernehmen' }));
      fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
      const retryButton = await screen.findByRole('button', {
        name: 'events.actions.retryMediaReferences',
      });
      expect(hasUnsavedChanges()).toBe(true);
      expect(navigateMock).not.toHaveBeenCalled();
      if (editAfterPartial)
        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Newer title' } });
      fireEvent.click(retryButton);
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'events.actions.retryMediaReferences' })
        ).toBeNull()
      );
      expect(hasUnsavedChanges()).toBe(editAfterPartial);
      expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe(
        editAfterPartial ? 'Newer title' : 'Draft event'
      );
      await act(async () => {
        fireEvent.submit(document.querySelector('form')!);
      });
      await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    }
  );

  it('leave guard returns to clean after adding and removing the initial medium', async () => {
    render(<EventsDetailPage mode="create" />);
    await screen.findByLabelText('Titel');
    expect(hasUnsavedChanges()).toBe(false);
    fireEvent.click(document.getElementById('content-media-add')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Medium per Link hinzufügen' }));
    await waitFor(() => expect(hasUnsavedChanges()).toBe(true));
    fireEvent.click(
      document.querySelector<HTMLButtonElement>('button[id^="content-media-"][id$="-remove"]')!
    );
    await waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  });

  it('leave guard keeps failed creates protected', async () => {
    vi.mocked(createEvent).mockRejectedValueOnce(new Error('network timeout'));
    render(<EventsDetailPage mode="create" />);
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('events.messages.saveError')).toBeTruthy());
    expect(hasUnsavedChanges()).toBe(true);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Unsaved draft');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('leave guard preserves changes made during create and prevents a second create', async () => {
    let finishSave!: (value: unknown) => void;
    vi.mocked(createEvent).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = resolve as typeof finishSave;
        })
    );
    navigateMock.mockImplementation(async () => {
      expect(hasUnsavedChanges()).toBe(true);
      throw new Error('navigation failed');
    });
    render(<EventsDetailPage mode="create" />);
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Before save' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    expect(hasUnsavedChanges()).toBe(true);
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'After save started' } });
    finishSave({ id: 'event-created', title: 'Before save', name: 'Before save' });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText('events.messages.createdNavigationError')).toBeTruthy()
    );
    expect(hasUnsavedChanges()).toBe(true);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('After save started');
    expect(screen.getByRole('link', { name: 'events.actions.openSavedContent' })).toBeTruthy();
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });
    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
  });

  it('renders the fixed tab order for saved events', async () => {
    vi.mocked(getEvent).mockResolvedValue({ id: 'event-1', title: 'Event' } as never);
    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    });

    expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
  });

  it('shows event-specific cards inside the content tab', async () => {
    render(<EventsDetailPage mode="create" />);

    openEventExtras();

    await waitFor(() => {
      expect(screen.getByText('Termine')).toBeTruthy();
    });

    expect(screen.getByText('Veranstaltungsort')).toBeTruthy();
    expect(screen.getByText('Veranstalter')).toBeTruthy();
    expect(screen.getByText('Ansprechpartner')).toBeTruthy();
    expect(screen.getByText('Links')).toBeTruthy();
    expect(screen.getByText('Preise')).toBeTruthy();
    expect(screen.queryByText('Barrierefreiheit')).toBeNull();
  });

  it('shows the planned basis and settings cards in their dedicated edit tabs', async () => {
    vi.mocked(getEvent).mockResolvedValue({ id: 'event-1', title: 'Event' } as never);
    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await screen.findByRole('tab', { name: 'Basis' });
    expect(screen.getByText('Titel & Kategorie')).toBeTruthy();
    expect(screen.getByText('Serien-Logik')).toBeTruthy();
    expect(screen.queryByText('Verknüpfungen')).toBeNull();
    expect(screen.queryByLabelText('Zugehöriger POI')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));

    await waitFor(() => {
      expect(screen.getByText('Sichtbarkeit')).toBeTruthy();
    });
    expect(screen.getByText('Technische Zusatzdaten')).toBeTruthy();
    expect(screen.queryByLabelText('Schlagwörter')).toBeNull();
    expect(screen.queryByLabelText('Tags')).toBeNull();
    expect(vi.mocked(listPoiForEventSelection)).not.toHaveBeenCalled();
  });

  it('maps recurring type to the fixed event options', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByLabelText('Wiederholung'));
    const recurringTypeSelect = await screen.findByLabelText('Wiederholungstyp');
    fireEvent.change(recurringTypeSelect, { target: { value: '1' } });

    expect(screen.getByRole('option', { name: 'Tage' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Wochen' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Monate' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Jahre' })).toBeTruthy();
    expect((recurringTypeSelect as HTMLSelectElement).value).toBe('1');
  });

  it.each(['0', '-1', '1.5'])(
    'preserves native interval validation for %s',
    async (invalidInterval) => {
      render(<EventsDetailPage mode="create" />);
      fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Termin' } });
      fireEvent.click(screen.getByLabelText('Wiederholung'));
      const input = document.getElementById('event-recurring-interval') as HTMLInputElement;
      fireEvent.change(input, { target: { value: invalidInterval } });
      const form = input.closest('form')!;
      const validity = vi.spyOn(form, 'reportValidity');
      fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
      await waitFor(() => expect(validity).toHaveBeenCalled());
      expect(validity.mock.results[0]?.value).toBe(false);
      expect(createEvent).not.toHaveBeenCalled();
      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
      await waitFor(() => expect(createEvent).toHaveBeenCalled());
      expect(vi.mocked(createEvent).mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ recurringInterval: '2' })
      );
    }
  );

  it.each(['missing_credentials', 'organization_mainserver_credentials_missing'])(
    'explains credential failures without backend details: %s',
    async (code) => {
      vi.mocked(createEvent).mockRejectedValueOnce(
        new EventsApiError(code, 'API-Key or API-Secret missing')
      );
      render(<EventsDetailPage mode="create" />);
      fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'New content' } });
      fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
      await waitFor(() => expect(screen.getByText('events.create.saveUnavailable')).toBeTruthy());
      expect(screen.queryByText(/API-Key/)).toBeNull();
      expect(screen.getByDisplayValue('New content')).toBeTruthy();
    }
  );

  it('shows a copyable request reference when a save fails', async () => {
    const error = new EventsApiError('forbidden', 'Forbidden');
    Object.defineProperty(error, 'requestId', { value: 'events-request-123' });
    vi.mocked(createEvent).mockRejectedValueOnce(error);
    render(<EventsDetailPage mode="create" />);
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'New content' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nicht sichtbar anlegen' }));

    expect(await screen.findByText('events-request-123')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'events.messages.copyRequestReference' })
    ).toBeTruthy();
  });

  it('renders Create without tabs or history and keeps a single ordered form', async () => {
    render(<EventsDetailPage mode="create" />);
    await screen.findByLabelText('Titel');
    expect(hasUnsavedChanges()).toBe(false);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Historie' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Speichern|anlegen/ })).toHaveLength(1);
    const ids = [...document.querySelectorAll('[id^="event-create-"]')].map(
      (element) => element.id
    );
    expect(ids).toEqual(
      [
        'title',
        'dates',
        'recurrence',
        'addresses',
        'description',
        'media',
        'categories',
        'organizer',
        'contacts',
        'links',
        'prices',
        'technical',
        'publication',
      ].map((id) => `event-create-${id}`)
    );
    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(document.querySelector('details')?.open).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Nicht sichtbar anlegen' })).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('Sichtbar'));
    expect(screen.getAllByRole('button', { name: 'Sichtbar anlegen' })).toHaveLength(1);
    expect(screen.getByText('events.create.visibleEffect')).toBeTruthy();
    expect(document.querySelector('nav')).toBeNull();
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('keeps read-only event editors from saving or deleting', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['events.read'],
      assignedModules: ['events'],
      roles: [],
    });
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-read-only',
      title: 'Nur lesen',
    } as never);

    const { container } = render(<EventsDetailPage mode="edit" contentId="event-read-only" />);

    await screen.findByDisplayValue('Nur lesen');
    expect(screen.queryByRole('button', { name: /Speichern|anlegen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();

    const form = container.querySelector('form');
    if (!form) throw new Error('event_form_missing');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(vi.mocked(updateEvent)).not.toHaveBeenCalled();
    });
  });

  it('renders the event editor after the core item loaded', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1944004',
      title: 'Stadtfest',
      description: 'Innenstadt',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      urls: [{ url: 'https://example.com/events' }],
    } as never);
    render(<EventsDetailPage mode="edit" contentId="1944004" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });
  });

  it('normalizes loaded event dates to date-only inputs in edit mode', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1944005',
      title: 'Sommerfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z', dateEnd: '2026-06-12T18:00:00.000Z' }],
    } as never);

    render(<EventsDetailPage mode="edit" contentId="1944005" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Startdatum') as HTMLInputElement).value).toBe('11.06.2026');
    });

    expect((screen.getByLabelText('Enddatum') as HTMLInputElement).value).toBe('12.06.2026');
  });

  it('retains other dates and input identity when changing the first date', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1280',
      title: 'Mehrere Termine',
      dates: [
        { dateStart: '2026-09-09', dateEnd: '2026-09-10' },
        { dateStart: '2026-10-09', dateEnd: '2026-10-10' },
      ],
    } as never);
    render(<EventsDetailPage mode="edit" contentId="1280" />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));
    const first = await screen.findByLabelText('Startdatum', { selector: '#event-date-start' });
    first.focus();
    fireEvent.change(first, { target: { value: '8.9.2026' } });
    expect(screen.getByLabelText('Startdatum', { selector: '#event-date-start' })).toBe(first);
    expect(document.activeElement).toBe(first);
    expect(
      (screen.getByLabelText('Startdatum', { selector: '#event-date-start-1' }) as HTMLInputElement)
        .value
    ).toBe('09.10.2026');
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
    await waitFor(() => expect(updateEvent).toHaveBeenCalled());
    expect(vi.mocked(updateEvent).mock.calls[0]?.[1].dates).toEqual([
      expect.objectContaining({ dateStart: '2026-09-08', dateEnd: '2026-09-10' }),
      expect.objectContaining({ dateStart: '2026-10-09', dateEnd: '2026-10-10' }),
    ]);
  });

  it('blocks an invalid second date from another tab and focuses its preserved draft', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1280',
      title: 'Mehrere Termine',
      dates: [{ dateStart: '2026-09-09' }, { dateStart: '2026-10-09' }],
    } as never);
    render(<EventsDetailPage mode="edit" contentId="1280" />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));
    const input = await screen.findByLabelText('Startdatum', { selector: '#event-date-start-1' });
    fireEvent.change(input, { target: { value: '31.02.' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Basis' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(updateEvent).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('31.02.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks submission on invalid title, invalid date input, and non-https links', async () => {
    render(<EventsDetailPage mode="create" />);

    openEventExtras();
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: 'invalid-date' } });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'http://example.com/events' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
    });

    expect(screen.getByDisplayValue('http://example.com/events')).toBeTruthy();
  });

  it('keeps the missing title reachable in Create', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click((await screen.findAllByRole('button', { name: /Speichern|anlegen/ }))[0]!);

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
    });

    expect(screen.getByLabelText('Titel')).toBeTruthy();
  });

  it('keeps the invalid event url reachable in Create', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    openEventExtras();
    fireEvent.change(await screen.findByLabelText('URL'), {
      target: { value: 'http://invalid.example' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
      expect(screen.getByLabelText('URL')).toBeTruthy();
    });
  });

  it('requires and focuses the organizer name when organizer details are entered', async () => {
    vi.mocked(createEvent).mockResolvedValue({
      id: 'event-created',
      title: 'Neues Event',
    } as never);
    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    openEventExtras();
    fireEvent.change(
      await screen.findByLabelText('E-Mail', { selector: '#event-organizer-email' }),
      {
        target: { value: 'kontakt@example.test' },
      }
    );
    const organizerSection = document.getElementById('event-create-organizer')!.closest('details')!;
    fireEvent.click(organizerSection.querySelector('summary')!);
    expect(organizerSection.open).toBe(false);
    const saveButton = screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0];
    if (!saveButton) throw new Error('event_save_button_missing');
    fireEvent.click(saveButton);

    const organizerName = await screen.findByLabelText('Institution/Firma');
    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
      expect(organizerName.getAttribute('aria-required')).toBe('true');
      expect(organizerName.getAttribute('aria-invalid')).toBe('true');
      expect(organizerSection.open).toBe(true);
      expect(document.activeElement).toBe(organizerName);
    });
    expect(
      screen.getByText(
        'Geben Sie einen Namen für den Veranstalter ein oder entfernen Sie die übrigen Veranstalterangaben.'
      )
    ).toBeTruthy();

    fireEvent.change(organizerName, { target: { value: 'Kulturamt' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(createEvent)).toHaveBeenCalledWith(
        expect.objectContaining({
          organizer: {
            name: 'Kulturamt',
            contact: { email: 'kontakt@example.test' },
          },
        }),
        'user'
      );
    });
  });

  it('reports incomplete organizer coordinates before they can be discarded', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    openEventExtras();
    const latitude = await screen.findByLabelText('Breitengrad', {
      selector: '#event-organizer-latitude',
    });
    fireEvent.change(latitude, { target: { value: '51.4' } });
    const saveButton = screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0];
    if (!saveButton) throw new Error('event_save_button_missing');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
      expect(latitude.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(latitude);
      expect(screen.getByLabelText('Institution/Firma').getAttribute('aria-required')).toBe('true');
    });
  });

  it('updates events with inline media contents on save', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      description: 'Innenstadt',
      mediaContents: [
        {
          sourceUrl: { url: 'https://example.com/header.jpg', description: 'Header' },
          captionText: 'Headerbild',
        },
      ],
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      urls: [{ url: 'https://example.com/events' }],
    } as never);
    vi.mocked(updateEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
    } as never);

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(vi.mocked(updateEvent)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(updateEvent)).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          mediaContents: [
            expect.objectContaining({
              sourceUrl: { url: 'https://example.com/header.jpg', description: 'Header' },
            }),
          ],
        }),
        'user'
      );
      expect(screen.getAllByRole('button', { name: 'events.actions.saved' })).toHaveLength(2);
    });
  });

  it('surfaces repeated media-reference failures and clears the retry after success', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      mediaContents: [{ sourceUrl: { url: 'https://example.com/header.jpg' } }],
      dates: [],
      addresses: [],
      urls: [],
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
    ]);
    vi.mocked(updateEvent).mockResolvedValueOnce({ id: 'event-1', title: 'Stadtfest' } as never);
    const retry = vi
      .fn()
      .mockRejectedValueOnce(new Error('again'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(saveContentWithHostMediaReferences).mockImplementationOnce(async (input) => ({
      status: 'reference_failed',
      saved: await input.saveContent(),
      retryReferenceSync: retry,
    }));
    render(<EventsDetailPage mode="edit" contentId="event-1" />);
    await screen.findByDisplayValue('Stadtfest');
    vi.mocked(getHostMediaAsset).mockResolvedValueOnce({ metadata: {} } as never);
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    fireEvent.click(screen.getByRole('button', { name: 'events.media.refresh' }));
    await screen.findByText('events.media.refreshTitle');
    fireEvent.click(screen.getByRole('button', { name: 'events.actions.cancel' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
    await screen.findByText('events.messages.mediaReferencePartialFailure');
    fireEvent.click(screen.getByRole('button', { name: 'events.actions.retryMediaReferences' }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'events.actions.retryMediaReferences' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'events.actions.retryMediaReferences' })
      ).toBeNull()
    );
  });

  it('keeps a selected upload local until the event is saved', async () => {
    render(<EventsDetailPage mode="create" />);

    openEventExtras();
    expect(hasUnsavedChanges()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: {
        files: [new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })],
      },
    });
    expect(hasUnsavedChanges()).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() =>
      expect(document.querySelector<HTMLImageElement>('article img')?.src).toMatch(/^blob:/)
    );
    expect((screen.getByLabelText('Medien-URL') as HTMLInputElement).value).toBe('');
    expect(hasUnsavedChanges()).toBe(true);
    expect(vi.mocked(uploadHostMediaFile)).not.toHaveBeenCalled();
    expect(vi.mocked(getHostMediaAsset)).not.toHaveBeenCalled();
    expect(screen.queryByText('Bild-URL konnte nicht ermittelt werden.')).toBeNull();
  });

  it('creates events and navigates to the new detail page', async () => {
    navigateMock.mockImplementation(async () => {
      expect(hasUnsavedChanges()).toBe(false);
    });
    vi.mocked(createEvent).mockResolvedValueOnce({
      id: 'event-created',
      title: 'Neues Event',
    } as never);
    vi.mocked(listEventCategories).mockResolvedValueOnce([
      { id: 'cat-1', name: 'Kultur' },
    ] as never);
    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    const categoryTrigger = screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' });
    await waitFor(() => {
      expect(categoryTrigger.hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(categoryTrigger);
    fireEvent.click(screen.getByLabelText('Kultur'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kategorie Kultur entfernen' })).toBeTruthy();
    });
    openEventExtras();
    fireEvent.change(screen.getByLabelText('Externe ID'), { target: { value: 'event-ext-1' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(vi.mocked(createEvent)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createEvent)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neues Event',
          categoryName: 'Kultur',
          categories: [{ name: 'Kultur' }],
          externalId: 'event-ext-1',
          visible: false,
        }),
        'user'
      );
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/admin/events/$id',
          params: { id: 'event-created' },
          state: expect.any(Function),
        })
      );
    });
  });

  it('shows translated fallback errors when loading or saving fails unexpectedly', async () => {
    vi.mocked(getEvent).mockRejectedValueOnce(new Error('load boom'));

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByText('events.messages.missingContent')).toBeTruthy();
    });

    cleanup();
    vi.mocked(createEvent).mockRejectedValueOnce(new Error('save boom'));

    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(screen.getByText('events.messages.saveError')).toBeTruthy();
    });
  });

  it('keeps the event editable when media references fail to load', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Sommerfest',
      mediaContents: [],
      dates: [],
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockRejectedValueOnce(
      new Error('reference load failed')
    );

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    expect(await screen.findByDisplayValue('Sommerfest')).toBeTruthy();
    expect(screen.getByText('Medienreferenzen konnten nicht geladen werden.')).toBeTruthy();
    expect(screen.queryByText('events.messages.missingContent')).toBeNull();
  });

  it('does not delete or navigate away when deletion is cancelled', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(screen.getByRole('alertdialog', { name: 'Veranstaltung löschen?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'events.actions.cancel' }));

    expect(vi.mocked(deleteEvent)).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows the delete fallback error when deleting fails unexpectedly', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.mocked(deleteEvent).mockRejectedValueOnce(new Error('delete boom'));
    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.getByText('Event konnte nicht gelöscht werden.')).toBeTruthy();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it('preserves deletion feedback and a route back when navigation fails', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    navigateMock.mockRejectedValueOnce(new Error('navigation failed'));
    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await screen.findByDisplayValue('Stadtfest');
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(vi.mocked(deleteEvent)).toHaveBeenCalledWith('event-1', 'user');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(screen.queryByText('Event konnte nicht gelöscht werden.')).toBeNull();
    expect(screen.getByText('Event wurde gelöscht.')).toBeTruthy();
    expect(
      screen.getByText('Event wurde gelöscht, aber die Inhaltsliste konnte nicht geöffnet werden.')
    ).toBeTruthy();
    expect(screen.getAllByText('Zurück zur Liste').length).toBeGreaterThan(1);
  });

  it('updates events even without media contents', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.mocked(updateEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
    } as never);

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neues Stadtfest' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(vi.mocked(updateEvent)).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole('button', { name: 'events.actions.saved' })).toHaveLength(2);
    });
  });

  it('returns the save action to idle when a degraded-field correction is cancelled', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.mocked(getEventDetail).mockImplementationOnce(async (contentId) => ({
      data: await vi.mocked(getEvent)(contentId),
      deviations: [{ fieldGroup: 'title' }] as never,
    }));
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    expect(await screen.findByDisplayValue('Stadtfest')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neues Stadtfest' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Speichern|anlegen/ })).toHaveLength(2);
    });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('shows a localized summary for degraded Mainserver field groups', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.mocked(getEventDetail).mockImplementationOnce(async (contentId) => ({
      data: await vi.mocked(getEvent)(contentId),
      deviations: [{ fieldGroup: 'dates' }] as never,
    }));

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    expect(
      await screen.findByText('Einige Datenbereiche konnten nicht vollständig gelesen werden.')
    ).toBeTruthy();
    expect(screen.getByText('Betroffener Bereich')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /Speichern|anlegen/ })[0]!);
    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.not.objectContaining({ dates: expect.anything() }),
        'user'
      );
    });
  });

  it('deletes events after confirmation and returns to the content overview', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(screen.getByText(/Die Veranstaltung/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(vi.mocked(deleteEvent)).toHaveBeenCalledWith('event-1', 'user');
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/admin/content', state: expect.any(Function) })
      );
    });
    const navigation = navigateMock.mock.calls[0]?.[0] as {
      state: (previous: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(navigation.state({ preserved: true })).toEqual({
      preserved: true,
      studioActionFeedback: {
        kind: 'destructive-complete',
        resourceId: 'event-1',
        resourceType: 'events',
      },
    });
  });
});
