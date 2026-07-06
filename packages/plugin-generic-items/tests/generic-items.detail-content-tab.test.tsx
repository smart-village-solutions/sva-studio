import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { GenericItemsDetailContentTab } from '../src/generic-items.detail-content-tab.js';
import { createDefaultGenericItemsDetailFormValues } from '../src/generic-items.detail-form.js';
import type { GenericItemsDetailFormValues } from '../src/generic-items.validation.js';

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
    label: 'Bürgerbüro, Bochum',
    street: 'Marktplatz',
    houseNumber: '1',
    postalCode: '44787',
    city: 'Bochum',
    coordinates: { latitude: 51.4818, longitude: 7.2162 },
  })),
  reverseCoordinates: vi.fn(async () => ({
    source: 'geoapify' as const,
    label: 'Bürgerbüro, Rathausplatz 3, 44787 Bochum',
    street: 'Rathausplatz',
    houseNumber: '3',
    postalCode: '44787',
    city: 'Bochum',
    country: 'Deutschland',
    coordinates: { latitude: 51.482, longitude: 7.2166 },
  })),
}));

vi.mock('../src/generic-items.map-geocoding-client.js', () => ({
  getMapGeocodingConfig: () => geocodingState.getConfig(),
  geocodeMapAddress: (input: { address: unknown }) => geocodingState.geocodeAddress(input),
  reverseMapCoordinates: (input: { latitude: number; longitude: number }) => geocodingState.reverseCoordinates(input),
}));

vi.mock('../src/generic-items.location-map.js', () => ({
  GenericItemsLocationMap: ({
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
    }: {
      id: string;
      value: string;
      onChange: (nextValue: string) => void;
      labelId?: string;
    }) => <textarea id={id} aria-labelledby={labelId} value={value} onChange={(event) => onChange(event.target.value)} />,
  };
});

const labels: Record<string, string> = {
  textTitle: 'Text',
  textDescription: 'Textbeschreibung',
  teaser: 'Teaser',
  contentBlocks: 'Content-Blocks',
  addContentBlock: 'Block hinzufügen',
  contentBlockItem: 'Inhaltsblock',
  title: 'Titel',
  intro: 'Intro',
  body: 'Inhalt',
  richTextParagraph: 'Absatz',
  richTextHeading2: 'Überschrift 2',
  richTextHeading3: 'Überschrift 3',
  richTextBlockquote: 'Zitat',
  richTextBlockType: 'Textformat',
  richTextBulletList: 'Aufzählung',
  richTextOrderedList: 'Nummerierung',
  richTextBold: 'Fett',
  richTextItalic: 'Kursiv',
  richTextUndo: 'Zurück',
  richTextRedo: 'Vorwärts',
  richTextApplyLink: 'Link setzen',
  richTextLinkInput: 'Link-URL',
  classificationTitle: 'Klassifikation',
  classificationDescription: 'Klassifikation Beschreibung',
  categoryName: 'Primärkategorie',
  categories: 'Kategorien',
  relationsTitle: 'Kontakte & Orte',
  relationsDescription: 'Relationen Beschreibung',
  addresses: 'Adressen',
  addAddress: 'Adresse hinzufügen',
  addressItem: 'Adresse',
  addressKind: 'Adressart',
  contacts: 'Kontakte',
  addContact: 'Kontakt hinzufügen',
  contactItem: 'Kontakt',
  firstName: 'Vorname',
  lastName: 'Nachname',
  email: 'E-Mail',
  phone: 'Telefon',
  locations: 'Orte',
  locationName: 'Ortsname',
  department: 'Bereich',
  district: 'Bezirk',
  regionName: 'Region',
  state: 'Bundesland/Land',
  linksMediaTitle: 'Links & Medien',
  linksMediaDescription: 'Links & Medien Beschreibung',
  secondaryTitle: 'Zusatzinformationen',
  secondaryDescription: 'Zusatzinformationen Beschreibung',
  mediaContents: 'Medien',
  mediaCaption: 'Bildunterschrift',
  mediaCopyright: 'Copyright',
  mediaContentType: 'Medientyp',
  imageSearch: 'Bildsuche',
  webUrls: 'Web-Links',
  addLink: 'Link hinzufügen',
  linkItem: 'Link',
  url: 'URL',
  urlDescription: 'Linkbeschreibung',
  scheduleTitle: 'Termine & Öffnungszeiten',
  scheduleDescription: 'Terminbeschreibung',
  openingHours: 'Öffnungszeiten',
  addOpeningHour: 'Öffnungszeit hinzufügen',
  addImage: 'Aus Medienbibliothek wählen',
  addLocation: 'Ort hinzufügen',
  uploadMedia: 'Bild hochladen',
  uploadingMedia: 'Bild wird hochgeladen',
  addMediaManual: 'Medium manuell ergänzen',
  selectImage: 'Bild auswählen',
  removeImage: 'Bild entfernen',
  openingHourItem: 'Öffnungszeit',
  locationItem: 'Ort',
  dateFrom: 'Datum von',
  dateTo: 'Datum bis',
  timeFrom: 'Uhrzeit von',
  timeTo: 'Uhrzeit bis',
  description: 'Beschreibung',
  weekday: 'Wochentag',
  open: 'Geöffnet',
  notAvailable: 'Nicht verfügbar',
  mediaTypeUnspecified: 'Nicht festgelegt',
  mediaTypeimage: 'Bild',
  mediaTypeaudio: 'Audio',
  mediaTypevideo: 'Video',
  mediaTypelogo: 'Logo',
  mediaTypeattachment: 'Anhang',
  weekdayMO: 'Montag',
  weekdayTU: 'Dienstag',
  weekdayWE: 'Mittwoch',
  weekdayTH: 'Donnerstag',
  weekdayFR: 'Freitag',
  weekdaySA: 'Samstag',
  weekdaySU: 'Sonntag',
  dates: 'Termine',
  addDate: 'Termin hinzufügen',
  dateItem: 'Termin',
  accessibilityInformations: 'Barrierefreiheit',
  accessibilityTypes: 'Barrierefreiheits-Typen',
  accessibilityLinks: 'Weiterführende Links',
  addAccessibilityInformation: 'Barrierefreiheit hinzufügen',
  accessibilityInformationItem: 'Barrierefreiheitsangabe',
  priceInformations: 'Preise',
  priceName: 'Preisname',
  priceAmount: 'Betrag',
  priceCategory: 'Preiskategorie',
  priceDescription: 'Preisbeschreibung',
  groupPrice: 'Gruppenpreis',
  ageFrom: 'Alter von',
  ageTo: 'Alter bis',
  minAdultCount: 'Erwachsene mindestens',
  maxAdultCount: 'Erwachsene höchstens',
  minChildrenCount: 'Kinder mindestens',
  maxChildrenCount: 'Kinder höchstens',
  addPriceInformation: 'Preis hinzufügen',
  priceInformationItem: 'Preiseintrag',
  dateStart: 'Start',
  dateEnd: 'Ende',
  timeStart: 'Beginn',
  timeEnd: 'Ende Uhrzeit',
  timeDescription: 'Zeitbeschreibung',
  useOnlyTimeDescription: 'Nur Zeitbeschreibung verwenden',
  remove: 'Entfernen',
  'fields.addressAddition': 'Adresszusatz',
  'fields.street': 'Straße',
  'fields.zip': 'PLZ',
  'fields.city': 'Ort',
  'fields.latitude': 'Breitengrad',
  'fields.longitude': 'Längengrad',
  'actions.geocodeAddress': 'Geo-Koordinaten ermitteln',
  'actions.geocodingAddress': 'Geo-Koordinaten werden ermittelt',
  'actions.reverseGeocodeAddress': 'Adresse ermitteln',
  'actions.reverseGeocodingAddress': 'Adresse wird ermittelt',
  'messages.locationGeocodeDisabled': 'Geo-Koordinaten sind für diese Instanz derzeit nicht verfügbar.',
  'messages.locationGeocodeEmpty': 'Keine Koordinaten gefunden.',
  'messages.locationGeocodeRateLimited': 'Geocoding-Limit erreicht.',
  'messages.locationGeocodeTimeout': 'Geocoding hat zu lange gedauert.',
  'messages.locationGeocodeForbidden': 'Berechtigung für Geocoding fehlt.',
  'messages.locationGeocodeUnauthorized': 'Geocoding-Sitzung abgelaufen.',
  'messages.locationGeocodeError': 'Geo-Koordinaten konnten nicht ermittelt werden.',
  'messages.locationMapUnavailable': 'Karte nicht verfügbar.',
  'messages.locationMapError': 'Karte konnte nicht geladen werden.',
  'messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
  'messages.mediaUploadUploading': 'Bild wird hochgeladen.',
  'messages.mediaUploadFinalizing': 'Bild wird eingebunden.',
  'messages.mediaUploadSuccess': 'Bild wurde hinzugefügt.',
  'messages.mediaUploadError': 'Bild konnte nicht hochgeladen werden.',
  'messages.mediaUploadUnsupportedType': 'Dieser Dateityp wird nicht unterstützt.',
  'messages.mediaUploadUnavailableUrl': 'Dieses Medium hat keine öffentliche URL.',
  'validation.geoLocation': 'Koordinaten sind ungültig.',
  validationWebUrls: 'URLs müssen mit https:// beginnen.',
  mediaLibraryDescription: 'Externe Verweise und Medienobjekte.',
  imagePickerEmpty: 'Keine passenden Bilder gefunden.',
  'fields.locationName': 'Ortsname',
  'fields.department': 'Bereich',
  'fields.district': 'Bezirk',
  'fields.regionName': 'Region',
  'fields.state': 'Bundesland/Land',
};

function renderTab(defaultValues?: Partial<GenericItemsDetailFormValues>) {
  let getCurrentValues: (() => GenericItemsDetailFormValues) | undefined;

  const Wrapper = () => {
    const methods = useForm<GenericItemsDetailFormValues>({
      defaultValues: {
        ...createDefaultGenericItemsDetailFormValues(),
        ...defaultValues,
      } as GenericItemsDetailFormValues,
    });
    getCurrentValues = methods.getValues;

    return (
      <FormProvider {...methods}>
        <GenericItemsDetailContentTab labels={labels} />
      </FormProvider>
    );
  };

  const view = render(<Wrapper />);

  return {
    ...view,
    getValues: () => getCurrentValues?.() as GenericItemsDetailFormValues,
  };
}

describe('GenericItemsDetailContentTab', () => {
  it('updates structured accessibility and price information rows', async () => {
    const { getValues } = renderTab();

    fireEvent.change(screen.getByLabelText('Barrierefreiheits-Typen'), { target: { value: 'wheelchair' } });
    fireEvent.change(screen.getAllByLabelText('URL')[1] as HTMLInputElement, {
      target: { value: 'https://example.org/barrierefreiheit' },
    });
    fireEvent.change(screen.getByLabelText('Preisname'), { target: { value: 'Regulär' } });
    fireEvent.change(screen.getByLabelText('Betrag'), { target: { value: '12.5' } });
    fireEvent.click(screen.getByLabelText('Gruppenpreis'));

    await waitFor(() => {
      expect(getValues().accessibilityInformations[0]).toMatchObject({
        types: 'wheelchair',
        urls: [{ url: 'https://example.org/barrierefreiheit', description: '' }],
      });
      expect(getValues().priceInformations[0]).toMatchObject({
        name: 'Regulär',
        amount: '12.5',
        groupPrice: true,
      });
    });
  });

  it('geocodes addresses, accepts map updates and reverse geocodes coordinates', async () => {
    const { getValues } = renderTab();

    fireEvent.change(screen.getByLabelText('Adresszusatz'), { target: { value: 'Rathaus' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Marktplatz 1' } });
    fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '44787' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Bochum' } });

    const geocodeButton = await screen.findByRole('button', { name: 'Geo-Koordinaten ermitteln' });
    fireEvent.click(geocodeButton);

    await waitFor(() => {
      expect(getValues().addresses[0]).toMatchObject({ latitude: '51.4818', longitude: '7.2162' });
    });

    const mapButtons = await screen.findAllByRole('button', { name: 'Kartenpunkt setzen' });
    fireEvent.click(mapButtons[0]!);

    await waitFor(() => {
      expect(getValues().addresses[0]).toMatchObject({ latitude: '50.123456', longitude: '8.654321' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Adresse ermitteln' }));

    await waitFor(() => {
      expect(getValues().addresses[0]).toMatchObject({
        street: 'Rathausplatz 3',
        zip: '44787',
        city: 'Bochum',
      });
    });
  });

  it('geocodes locations, accepts map updates and reverse geocodes coordinates', async () => {
    const { getValues } = renderTab();

    fireEvent.change(screen.getByLabelText('Ortsname'), { target: { value: 'Bürgerbüro' } });
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value: 'Service' } });
    fireEvent.change(screen.getByLabelText('Bezirk'), { target: { value: 'Innenstadt' } });
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Bochum' } });

    const geocodeButtons = await screen.findAllByRole('button', { name: 'Geo-Koordinaten ermitteln' });
    fireEvent.click(geocodeButtons[0]!);

    await waitFor(() => {
      expect(getValues().locations[0]).toMatchObject({ latitude: '51.4818', longitude: '7.2162' });
    });

    const mapButtons = await screen.findAllByRole('button', { name: 'Kartenpunkt setzen' });
    fireEvent.click(mapButtons[1]!);

    await waitFor(() => {
      expect(getValues().locations[0]).toMatchObject({ latitude: '50.123456', longitude: '8.654321' });
    });

    const reverseButtons = await screen.findAllByRole('button', { name: 'Adresse ermitteln' });
    fireEvent.click(reverseButtons[0]!);

    await waitFor(() => {
      expect(getValues().locations[0]).toMatchObject({
        name: 'Bürgerbüro, Rathausplatz 3, 44787 Bochum',
        regionName: 'Bochum',
        state: 'Deutschland',
      });
    });
  });
});
