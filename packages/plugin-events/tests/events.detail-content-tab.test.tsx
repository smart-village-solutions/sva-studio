import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { EventsDetailContentTab } from '../src/events.detail-content-tab.js';
import { createDefaultEventsDetailFormValues, type EventsDetailFormValues } from '../src/events.detail-form.js';

const geocodingState = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({
    provider: 'geoapify' as const,
    styleUrl: 'https://maps.example.test/style.json',
    killSwitchEnabled: false,
    geocodeEnabled: true,
    reverseGeocodeEnabled: true,
  })),
  geocodeAddress: vi.fn(async () => ({
    source: 'geoapify' as const,
    street: 'Marktplatz',
    houseNumber: '1',
    postalCode: '44787',
    city: 'Bochum',
    coordinates: { latitude: 51.4818, longitude: 7.2162 },
  })),
  reverseCoordinates: vi.fn(async () => ({
    source: 'geoapify' as const,
    street: 'Rathausplatz',
    houseNumber: '3',
    postalCode: '44787',
    city: 'Bochum',
    coordinates: { latitude: 51.482, longitude: 7.2166 },
  })),
}));

vi.mock('../src/events.map-geocoding-client.js', () => ({
  getMapGeocodingConfig: () => geocodingState.getConfig(),
  geocodeMapAddress: (input: { address: unknown }) => geocodingState.geocodeAddress(input),
  reverseMapCoordinates: (input: { latitude: number; longitude: number }) => geocodingState.reverseCoordinates(input),
}));

vi.mock('../src/events.location-map.js', () => ({
  EventsLocationMap: ({
    onCoordinatesChange,
  }: {
    onCoordinatesChange: (coordinates: { latitude: string; longitude: string }) => void;
  }) => (
    <button type="button" onClick={() => onCoordinatesChange({ latitude: '50.123456', longitude: '8.654321' })}>
      Kartenpunkt setzen
    </button>
  ),
}));

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
        data-testid="rich-text-editor"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ? 'true' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  };
});

const pt = (key: string) =>
  ({
    'cards.content.descriptions.title': 'Beschreibung',
    'cards.content.descriptions.description': 'Beschreibung des Events',
    'cards.content.dates.title': 'Termine',
    'cards.content.dates.description': 'Datumsangaben',
    'cards.content.dates.itemTitle': 'Termin',
    'cards.content.addresses.title': 'Veranstaltungsort',
    'cards.content.addresses.description': 'Ort des Events',
    'cards.content.addresses.itemTitle': 'Ort',
    'cards.content.organizer.title': 'Veranstalter',
    'cards.content.organizer.description': 'Organisation',
    'cards.content.contacts.title': 'Ansprechpartner',
    'cards.content.contacts.description': 'Kontaktmöglichkeiten',
    'cards.content.contacts.itemTitle': 'Kontakt',
    'cards.content.links.title': 'Links',
    'cards.content.links.description': 'Externe Links',
    'cards.content.links.itemTitle': 'Link',
    'cards.content.prices.title': 'Preise',
    'cards.content.prices.description': 'Preisangaben',
    'cards.content.prices.itemTitle': 'Preis',
    'cards.content.accessibility.title': 'Barrierefreiheit',
    'cards.content.accessibility.description': 'Barrierefreiheit',
    'fields.description': 'Beschreibung',
    'fields.dateStart': 'Startdatum',
    'fields.dateEnd': 'Enddatum',
    'fields.timeStart': 'Startzeit',
    'fields.timeEnd': 'Endzeit',
    'fields.weekday': 'Wochentag',
    'fields.timeDescription': 'Zeit-Hinweis',
    'fields.useOnlyTimeDescription': 'Nur Zeit-Hinweis verwenden',
    'fields.organizerName': 'Institution/Firma',
    'fields.firstName': 'Vorname',
    'fields.lastName': 'Nachname',
    'fields.street': 'Straße',
    'fields.addressAddition': 'Ortsbezeichnung',
    'fields.zip': 'PLZ',
    'fields.city': 'Ort',
    'fields.latitude': 'Breitengrad',
    'fields.longitude': 'Längengrad',
    'fields.email': 'E-Mail',
    'fields.phone': 'Telefon',
    'fields.url': 'URL',
    'fields.urlDescription': 'Link-Beschreibung',
    'fields.accessibilityDescription': 'Barrierefreiheitsbeschreibung',
    'fields.accessibilityTypes': 'Barrierefreiheitsarten',
    'fields.priceCategory': 'Preiskategorie',
    'fields.priceAmount': 'Preis',
    'fields.priceDescription': 'Preisbeschreibung',
    'actions.addDate': 'Termin hinzufügen',
    'actions.addAddress': 'Ort hinzufügen',
    'actions.addContact': 'Kontakt hinzufügen',
    'actions.addLink': 'Link hinzufügen',
    'actions.addPrice': 'Preis hinzufügen',
    'actions.geocodeAddress': 'Geo-Koordinaten ermitteln',
    'actions.geocodingAddress': 'Geo-Koordinaten werden ermittelt',
    'actions.reverseGeocodeAddress': 'Adresse ermitteln',
    'actions.reverseGeocodingAddress': 'Adresse wird ermittelt',
    'actions.remove': 'Entfernen',
    'messages.locationGeocodeError': 'Geo-Koordinaten konnten nicht ermittelt werden.',
    'messages.locationGeocodeEmpty': 'Keine Koordinaten gefunden.',
    'messages.locationMapUnavailable': 'Karte nicht verfügbar.',
    'messages.locationMapError': 'Karte konnte nicht geladen werden.',
    'validation.geoLocation': 'Koordinaten sind ungültig.',
    'richText.heading2': 'Überschrift 2',
    'richText.heading3': 'Überschrift 3',
    'richText.heading4': 'Überschrift 4',
    'richText.blockType': 'Textformat',
    'richText.paragraph': 'Absatz',
    'richText.blockquote': 'Zitat',
    'richText.bulletList': 'Aufzählung',
    'richText.orderedList': 'Nummerierung',
    'richText.bold': 'Fett',
    'richText.italic': 'Kursiv',
    'richText.undo': 'Zurück',
    'richText.redo': 'Vorwärts',
    'richText.linkInput': 'Link-URL',
    'richText.applyLink': 'Link setzen',
  })[key] ?? key;

function renderTab(defaultValues?: Partial<EventsDetailFormValues>) {
  const onDateStartInputChange = vi.fn();
  const onDateEndInputChange = vi.fn();
  let latestValues: EventsDetailFormValues | undefined;

  const Wrapper = () => {
    const methods = useForm<EventsDetailFormValues>({
      defaultValues: {
        ...createDefaultEventsDetailFormValues(),
        ...defaultValues,
      } as EventsDetailFormValues,
    });
    latestValues = methods.getValues();

    return (
      <FormProvider {...methods}>
        <EventsDetailContentTab
          dateEndInput=""
          dateInputsInvalid={{ dateStart: false, dateEnd: false }}
          dateStartInput=""
          onDateEndInputChange={onDateEndInputChange}
          onDateStartInputChange={onDateStartInputChange}
          pt={pt}
        />
      </FormProvider>
    );
  };

  const view = render(<Wrapper />);

  return {
    ...view,
    onDateEndInputChange,
    onDateStartInputChange,
    getValues: () => latestValues as EventsDetailFormValues,
  };
}

describe('EventsDetailContentTab', () => {
  it('propagates date input callbacks and persists the structured content sections', async () => {
    const { onDateEndInputChange, onDateStartInputChange, getValues } = renderTab();
    await screen.findAllByRole('button', { name: 'Kartenpunkt setzen' });

    fireEvent.change(screen.getByTestId('rich-text-editor'), { target: { value: '<p>Eventbeschreibung</p>' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-06-12T10:15' } });
    fireEvent.change(screen.getByLabelText('Enddatum'), { target: { value: '2026-06-12T12:30' } });
    fireEvent.change(screen.getByLabelText('Startzeit'), { target: { value: '10:15' } });
    fireEvent.change(screen.getByLabelText('Endzeit'), { target: { value: '12:30' } });
    fireEvent.change(screen.getByLabelText('Institution/Firma'), { target: { value: 'Stadtwerke' } });
    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Erika' } });
    fireEvent.change(screen.getByLabelText('Straße', { selector: '#event-street' }), { target: { value: 'Marktplatz 1' } });
    fireEvent.change(screen.getByLabelText('Ort', { selector: '#event-city' }), { target: { value: 'Musterstadt' } });
    fireEvent.change(screen.getByLabelText('E-Mail', { selector: '#event-contact-email' }), {
      target: { value: 'kontakt@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Telefon', { selector: '#event-contact-phone' }), {
      target: { value: '01234 5678' },
    });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/event' } });
    fireEvent.change(screen.getByLabelText('Link-Beschreibung'), { target: { value: 'Weitere Infos' } });
    fireEvent.change(screen.getByLabelText('Preiskategorie'), { target: { value: 'Erwachsene' } });
    fireEvent.change(screen.getByLabelText('Preis'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Barrierefreiheitsbeschreibung'), { target: { value: 'Stufenlos' } });

    expect(onDateStartInputChange).toHaveBeenCalledWith('2026-06-12T10:15');
    expect(onDateEndInputChange).toHaveBeenCalledWith('2026-06-12T12:30');
    expect(getValues().content.description).toBe('<p>Eventbeschreibung</p>');
    expect(getValues().content.dates?.[0]).toMatchObject({ timeStart: '10:15', timeEnd: '12:30' });
    expect(getValues().content.addresses?.[0]).toMatchObject({ street: 'Marktplatz 1', city: 'Musterstadt' });
    expect(getValues().content.contacts?.[0]).toMatchObject({
      firstName: 'Erika',
      email: 'kontakt@example.com',
      phone: '01234 5678',
    });
    expect(getValues().content.organizer).toMatchObject({ name: 'Stadtwerke' });
    expect(getValues().content.urls?.[0]).toMatchObject({
      url: 'https://example.com/event',
      description: 'Weitere Infos',
    });
    expect(getValues().content.priceInformations?.[0]).toMatchObject({ category: 'Erwachsene', amount: 12 });
    expect(getValues().content.accessibilityInformation).toMatchObject({ description: 'Stufenlos' });
  });

  it('geocodes event venue addresses, accepts map updates, and reverse geocodes organizer coordinates', async () => {
    const { getValues } = renderTab();
    await screen.findAllByRole('button', { name: 'Kartenpunkt setzen' });

    fireEvent.change(screen.getByLabelText('Straße', { selector: '#event-street' }), { target: { value: 'Marktplatz 1' } });
    fireEvent.change(screen.getByLabelText('PLZ', { selector: '#event-zip' }), { target: { value: '44787' } });
    fireEvent.change(screen.getByLabelText('Ort', { selector: '#event-city' }), { target: { value: 'Bochum' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Geo-Koordinaten ermitteln' })[0] as HTMLButtonElement);

    await screen.findByDisplayValue('51.4818');
    expect(getValues().content.addresses?.[0]?.geoLocation).toMatchObject({ latitude: '51.4818', longitude: '7.2162' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Kartenpunkt setzen' })[0] as HTMLButtonElement);
    expect(getValues().content.addresses?.[0]?.geoLocation).toMatchObject({ latitude: '50.123456', longitude: '8.654321' });

    fireEvent.change(screen.getByLabelText('Breitengrad', { selector: '#event-organizer-latitude' }), {
      target: { value: '51.4820' },
    });
    fireEvent.change(screen.getByLabelText('Längengrad', { selector: '#event-organizer-longitude' }), {
      target: { value: '7.2166' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Adresse ermitteln' })[1] as HTMLButtonElement);

    await waitFor(() => {
      expect(geocodingState.reverseCoordinates).toHaveBeenCalledWith({ latitude: 51.482, longitude: 7.2166 });
      expect(getValues().content.organizer.address).toMatchObject({
        street: 'Rathausplatz 3',
        zip: '44787',
        city: 'Bochum',
        geoLocation: { latitude: '51.4820', longitude: '7.2166' },
      });
    });
  });

  it('adds repeated entries for dates, contacts, links, and prices', async () => {
    renderTab();
    await screen.findAllByRole('button', { name: 'Kartenpunkt setzen' });

    fireEvent.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kontakt hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preis hinzufügen' }));

    expect(screen.getAllByText('Termin').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Kontakt').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Link').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Preis').length).toBeGreaterThan(1);
  });

  it('renders fallback values when optional arrays are initially missing', async () => {
    renderTab({
      content: {
        description: '',
        dates: [],
        addresses: [],
        urls: [],
        contacts: [],
        organizer: { name: '' },
        priceInformations: [],
        accessibilityInformation: { description: '', types: '', urls: [] },
      },
    });
    await screen.findAllByRole('button', { name: 'Kartenpunkt setzen' });

    expect((screen.getAllByLabelText('Startzeit')[0] as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Straße', { selector: '#event-street' }) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('');
  });
});
