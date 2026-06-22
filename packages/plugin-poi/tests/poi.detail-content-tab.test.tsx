import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { PoiDetailContentTab } from '../src/poi.detail-content-tab.js';
import type { PoiDetailFormValues } from '../src/poi.detail-form.js';

vi.mock('../src/poi.location-map.js', () => ({
  PoiLocationMap: () => <div data-testid="poi-location-map" />,
}));

vi.mock('@sva/studio-ui-react', async () => {
  const actual = await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      value,
      onChange,
    }: {
      id: string;
      value: string;
      onChange: (value: string) => void;
    }) => (
      <textarea
        id={id}
        aria-label="Beschreibung Editor"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  };
});

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    getHostMapGeocodingConfig: vi.fn(async () => ({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: false,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
    })),
  };
});

const pt = (key: string) =>
  ({
    'cards.location.address.title': 'Lage und Adresse',
    'cards.location.address.description': 'Adressdaten, Karte und Koordinaten',
    'cards.location.search.title': 'Adresssuche',
    'cards.location.search.description': 'Adresse suchen und übernehmen',
    'cards.description.text.title': 'Beschreibungen',
    'cards.description.text.description': 'Texte',
    'cards.contact.primary.title': 'Kontakt',
    'cards.contact.primary.description': 'Kontaktfelder',
    'cards.openingHours.entries.title': 'Öffnungszeiten',
    'cards.openingHours.entries.description': 'Zeitfenster',
    'cards.openingHours.entry.title': 'Öffnungszeit',
    'cards.links.entries.title': 'Weblinks',
    'cards.links.entries.description': 'Weblinks',
    'cards.operator.details.title': 'Betreiber',
    'cards.operator.details.description': 'Betriebsdaten',
    'cards.prices.entries.title': 'Preise',
    'cards.prices.entries.description': 'Preisangaben',
    'fields.name': 'Name',
    'fields.description': 'Beschreibung',
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
    'fields.street': 'Straße',
    'fields.city': 'Ort',
    'fields.zip': 'PLZ',
    'fields.locationName': 'Ortsbezeichnung',
    'fields.latitude': 'Breitengrad',
    'fields.longitude': 'Längengrad',
    'fields.firstName': 'Vorname',
    'fields.lastName': 'Nachname',
    'fields.email': 'E-Mail',
    'fields.phone': 'Telefon',
    'fields.weekday': 'Wochentag',
    'fields.dateFrom': 'Startdatum',
    'fields.dateTo': 'Enddatum',
    'fields.timeFrom': 'Startzeit',
    'fields.timeTo': 'Endzeit',
    'fields.open': 'Geöffnet',
    'fields.url': 'URL',
    'fields.urlDescription': 'Link-Beschreibung',
    'fields.operatorName': 'Name des Betreibers',
    'fields.priceName': 'Preisname',
    'fields.amount': 'Betrag',
    'fields.fax': 'Fax',
    'actions.addOpeningHour': 'Öffnungszeit hinzufügen',
    'actions.remove': 'Entfernen',
    'actions.geocodeAddress': 'Geo-Koordinaten ermitteln',
    'actions.geocodingAddress': 'Geo-Koordinaten werden ermittelt',
    'messages.locationMapUnavailable': 'Karte deaktiviert.',
    'messages.locationMapError': 'Karte nicht verfügbar.',
    'messages.locationGeocodeEmpty': 'Keine Geo-Koordinaten gefunden.',
    'messages.locationGeocodeError': 'Geo-Koordinaten nicht verfügbar.',
  })[key] ?? key;

function renderTab(defaultValues?: Partial<PoiDetailFormValues>) {
  const Wrapper = () => {
    const methods = useForm<PoiDetailFormValues>({
      defaultValues: {
        name: '',
        active: true,
        basis: { categoryName: '' },
        content: {
          description: '',
          mobileDescription: '',
          addresses: [{ street: '', zip: '', city: '', geoLocation: { latitude: '', longitude: '' } }],
          location: { name: '' },
          contact: { firstName: '', lastName: '', email: '', phone: '' },
          openingHours: [{ weekday: '', timeFrom: '', open: true }],
          webUrls: [{ url: '', description: '' }],
          operator: { name: '', contact: { email: '' } },
          prices: [{ name: '', amount: '' }],
          payloadText: '{}',
        },
        media: { images: [] },
        settings: {},
        ...defaultValues,
      } as PoiDetailFormValues,
    });

    return (
      <FormProvider {...methods}>
        <PoiDetailContentTab
          pt={pt}
        />
      </FormProvider>
    );
  };

  return render(<Wrapper />);
}

describe('PoiDetailContentTab', () => {
  it('renders the editorial section cards inside the content tab', async () => {
    renderTab({ name: 'Test POI' });

    expect(screen.getByText('Beschreibungen')).toBeTruthy();
    expect(screen.getByDisplayValue('Test POI')).toBeTruthy();
    expect(screen.getByLabelText('Beschreibung Editor')).toBeTruthy();
    expect(await screen.findByText('Lage und Adresse')).toBeTruthy();
    expect(screen.getByText('Kontakt')).toBeTruthy();
    expect(screen.getByText('Öffnungszeiten')).toBeTruthy();
    expect(screen.getByText('Öffnungszeit')).toBeTruthy();
    expect(screen.getByLabelText('Startdatum')).toBeTruthy();
    expect(screen.getByLabelText('Enddatum')).toBeTruthy();
    expect(screen.getByLabelText('Startzeit')).toBeTruthy();
    expect(screen.getByLabelText('Endzeit')).toBeTruthy();
    expect(screen.getAllByText('Weblinks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Betreiber').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Name des Betreibers')).toBeTruthy();
    expect(screen.getAllByLabelText('Vorname').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('Nachname').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('Fax').length).toBeGreaterThan(1);
    expect(screen.getByText('Preise')).toBeTruthy();
    expect(screen.queryByText('Medien')).toBeNull();
    expect(screen.getByRole('button', { name: 'Öffnungszeit hinzufügen' })).toBeTruthy();
  });
});
