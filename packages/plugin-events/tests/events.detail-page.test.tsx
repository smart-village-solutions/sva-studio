import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  getHostMediaAsset,
  listHostMediaAssets,
  registerPluginTranslationResolver,
  updateHostMediaAsset,
  uploadHostMediaFile,
} from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEventCategories,
  listPoiForEventSelection,
  updateEvent,
} from '../src/events.api.js';

import { EventsDetailPage } from '../src/events.detail-page.js';

const navigateMock = vi.fn();
vi.mock('../src/events.api.js', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  EventsApiError: class EventsApiError extends Error {},
  getEvent: vi.fn(),
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
    listHostMediaAssets: vi.fn(async () => []),
    updateHostMediaAsset: vi.fn(),
    uploadHostMediaFile: vi.fn(),
  };
});

vi.mock('@sva/studio-ui-react', async () => {
  const actual = await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
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
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

describe('EventsDetailPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(createEvent).mockReset();
    vi.mocked(deleteEvent).mockReset();
    vi.mocked(getEvent).mockReset();
    vi.mocked(listEventCategories).mockReset();
    vi.mocked(listEventCategories).mockResolvedValue([] as never);
    vi.mocked(listPoiForEventSelection).mockReset();
    vi.mocked(listPoiForEventSelection).mockResolvedValue([] as never);
    vi.mocked(updateEvent).mockReset();
    vi.mocked(getHostMediaAsset).mockReset();
    vi.mocked(listHostMediaAssets).mockReset();
    vi.mocked(listHostMediaAssets).mockResolvedValue([] as never);
    vi.mocked(updateHostMediaAsset).mockReset();
    vi.mocked(uploadHostMediaFile).mockReset();
    vi.unstubAllGlobals();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'events.detail.createTitle': 'Event anlegen',
        'events.detail.editTitle': 'Event bearbeiten',
        'events.actions.save': 'Speichern',
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
        'events.fields.mediaCopyright': 'Copyright',
        'events.fields.mediaContentType': 'Medientyp',
        'events.fields.mediaWidth': 'Breite',
        'events.fields.mediaHeight': 'Höhe',
        'events.fields.imageSearch': 'Bild suchen',
        'events.messages.validationError': 'Bitte Eingaben prüfen.',
        'events.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'events.messages.poiOptionsLoading': 'POI werden geladen.',
        'events.messages.poiOptionsEmpty': 'Keine passenden POI gefunden.',
        'events.messages.imagePickerEmpty': 'Keine passenden Medien gefunden.',
        'events.messages.mediaPickerTitle': 'Medium hinzufügen',
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
        'events.messages.updateSuccess': 'Event aktualisiert.',
        'events.messages.deleteError': 'Event konnte nicht gelöscht werden.',
        'events.actions.deleteConfirm': 'Wirklich löschen?',
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
  });

  it('renders the fixed tab order for events', async () => {
    render(<EventsDetailPage mode="create" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    });

    expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
  });

  it('shows event-specific cards inside the content tab', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));

    await waitFor(() => {
      expect(screen.getByText('Termine')).toBeTruthy();
    });

    expect(screen.getByText('Veranstaltungsort')).toBeTruthy();
    expect(screen.getByText('Veranstalter')).toBeTruthy();
    expect(screen.getByText('Ansprechpartner')).toBeTruthy();
    expect(screen.getByText('Links')).toBeTruthy();
    expect(screen.getByText('Preise')).toBeTruthy();
    expect(screen.getByText('Barrierefreiheit')).toBeTruthy();
  });

  it('shows the planned basis and settings cards in their dedicated tabs', async () => {
    render(<EventsDetailPage mode="create" />);

    await screen.findByRole('tab', { name: 'Basis' });
    expect(screen.getByText('Titel & Kategorie')).toBeTruthy();
    expect(screen.getByText('Serien-Logik')).toBeTruthy();
    expect(screen.getByText('Verknüpfungen')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));

    await waitFor(() => {
      expect(screen.getByText('Sichtbarkeit')).toBeTruthy();
    });
    expect(screen.getByText('Technische Zusatzdaten')).toBeTruthy();
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

  it('renders a global save action and a history placeholder for events', async () => {
    render(<EventsDetailPage mode="create" />);

    expect(await screen.findByRole('button', { name: 'Speichern' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
    await waitFor(() => {
      expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
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
      expect((screen.getByLabelText('Startdatum') as HTMLInputElement).value).toBe('2026-06-11');
    });

    expect((screen.getByLabelText('Enddatum') as HTMLInputElement).value).toBe('2026-06-12');
  });

  it('blocks submission on invalid title, invalid date input, and non-https links', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: 'invalid-date' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'http://example.com/events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
    });

    expect(screen.getByDisplayValue('http://example.com/events')).toBeTruthy();
  });

  it('keeps the basis tab active when the title is missing', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
    });

    expect(screen.getByLabelText('Titel')).toBeTruthy();
  });

  it('keeps the content tab active when only the event url is invalid', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    fireEvent.change(await screen.findByLabelText('URL'), { target: { value: 'http://invalid.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
      expect(screen.getByLabelText('URL')).toBeTruthy();
    });
  });

  it('updates events with inline media contents on save', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      description: 'Innenstadt',
      mediaContents: [{ sourceUrl: { url: 'https://example.com/header.jpg', description: 'Header' }, captionText: 'Headerbild' }],
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

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

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
        })
      );
      expect(screen.getByText('Event aktualisiert.')).toBeTruthy();
    });
  });

  it('uses the upload response url when the refreshed asset still has no preview url', async () => {
    vi.mocked(uploadHostMediaFile).mockResolvedValueOnce({
      assetId: 'asset-uploaded',
      previewUrl: 'https://example.com/uploaded.jpg',
      fileName: 'uploaded.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
    } as never);
    vi.mocked(listHostMediaAssets)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 'asset-uploaded',
          fileName: 'uploaded.jpg',
          mimeType: 'image/jpeg',
          previewUrl: '',
          visibility: 'public',
        },
      ] as never);
    vi.mocked(getHostMediaAsset).mockResolvedValueOnce({
      id: 'asset-uploaded',
      instanceId: 'de-test',
      storageKey: 'de-test/originals/uploaded.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      previewUrl: '',
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {
        title: 'uploaded.jpg',
        altText: '',
        description: '',
        copyright: '',
        license: '',
      },
    } as never);
    vi.mocked(updateHostMediaAsset).mockResolvedValueOnce({
      id: 'asset-uploaded',
      instanceId: 'de-test',
      storageKey: 'de-test/originals/uploaded.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      previewUrl: '',
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {
        title: 'uploaded.jpg',
        altText: '',
        description: '',
        copyright: '',
        license: '',
      },
    } as never);

    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medium hochladen' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: {
        files: [new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com/uploaded.jpg')).toBeTruthy();
    });
    expect(screen.queryByText('Bild-URL konnte nicht ermittelt werden.')).toBeNull();
  });

  it('creates events and navigates to the new detail page', async () => {
    vi.mocked(createEvent).mockResolvedValueOnce({
      id: 'event-created',
      title: 'Neues Event',
    } as never);
    vi.mocked(listEventCategories).mockResolvedValueOnce([{ id: 'cat-1', name: 'Kultur' }] as never);
    vi.mocked(listPoiForEventSelection).mockResolvedValue([{ id: 'poi-7', name: 'Rathaus' }] as never);

    render(<EventsDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neues Event' } });
    const categoryInput = screen.getByLabelText('Kategorien suchen');
    await waitFor(() => {
      expect(categoryInput.hasAttribute('disabled')).toBe(false);
    });
    fireEvent.change(categoryInput, { target: { value: 'Kultur' } });
    fireEvent.blur(categoryInput);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kategorie Kultur entfernen' })).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('POI suchen'), { target: { value: 'Rathaus' } });
    await waitFor(() => {
      expect(screen.getByText('Rathaus')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Rathaus').closest('button') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));
    fireEvent.change(screen.getByLabelText('Externe ID'), { target: { value: 'event-ext-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createEvent)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createEvent)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neues Event',
          categoryName: 'Kultur',
          categories: [{ name: 'Kultur' }],
          pointOfInterestId: 'poi-7',
          externalId: 'event-ext-1',
          visible: true,
        })
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/events/$id', params: { id: 'event-created' } });
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
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByText('events.messages.saveError')).toBeTruthy();
    });
  });

  it('does not delete or navigate away when deletion is cancelled', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.stubGlobal('confirm', vi.fn(() => false));

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

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
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.getByText('Event konnte nicht gelöscht werden.')).toBeTruthy();
      expect(navigateMock).not.toHaveBeenCalled();
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updateEvent)).toHaveBeenCalledTimes(1);
    });
  });

  it('deletes events after confirmation and returns to the content overview', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(vi.mocked(deleteEvent)).toHaveBeenCalledWith('event-1');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
    });
  });
});
