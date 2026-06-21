import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultPoiDetailFormValues, type PoiDetailFormValues } from '../src/poi.detail-form.js';
import { PoiDetailLocationTab } from '../src/poi.detail-location-tab.js';

const testTranslations: Record<string, string> = {
  'cards.location.address.title': 'Lage und Adresse',
  'cards.location.address.description': 'Adressdaten',
  'cards.location.coordinates.title': 'Koordinaten',
  'cards.location.coordinates.description': 'Geo-Daten',
  'cards.location.map.title': 'Karte',
  'cards.location.map.description': 'Marker setzen',
  'cards.location.search.title': 'Adresssuche',
  'cards.location.search.description': 'Adresse suchen und übernehmen',
  'fields.street': 'Straße',
  'fields.zip': 'PLZ',
  'fields.city': 'Ort',
  'fields.locationName': 'Ortsbezeichnung',
  'fields.latitude': 'Breitengrad',
  'fields.longitude': 'Längengrad',
  'fields.addressSearch': 'Adresse suchen',
  'fields.searchResults': 'Suchergebnisse',
  'actions.searchAddress': 'Adresse suchen',
  'actions.applySearchResult': 'Übernehmen',
  'actions.reverseGeocode': 'Adresse aus Koordinaten übernehmen',
  'actions.reverseGeocoding': 'Adresse wird ermittelt',
  'messages.locationSearchError': 'Adresssuche nicht verfügbar.',
  'messages.locationSearchEmpty': 'Keine Treffer gefunden.',
  'messages.locationReverseGeocodeError': 'Koordinatenauflösung nicht verfügbar.',
  'messages.locationReverseGeocodeEmpty': 'Keine Adresse zu Koordinaten gefunden.',
  'messages.locationMapUnavailable': 'Karte deaktiviert.',
  'messages.locationMapError': 'Karte nicht verfügbar.',
};

const geocodingState = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({
    provider: 'geoapify' as const,
    styleUrl: 'https://tileserver.example/style.json',
    autocompleteEnabled: true,
    geocodeEnabled: true,
    reverseGeocodeEnabled: true,
    killSwitchEnabled: false,
  })),
  suggestAddresses: vi.fn(async () => [
    {
      label: 'Musterstraße 1, 12345 Musterstadt',
      coordinates: { latitude: 51.5, longitude: 13.4 },
      street: 'Musterstraße',
      houseNumber: '1',
      postalCode: '12345',
      city: 'Musterstadt',
      country: 'Deutschland',
      countryCode: 'de',
      source: 'geoapify' as const,
    },
  ]),
  reverseCoordinates: vi.fn(async () => ({
    label: 'Rückweg 2, 54321 Rückstadt',
    coordinates: { latitude: 48.1, longitude: 11.5 },
    street: 'Rückweg',
    houseNumber: '2',
    postalCode: '54321',
    city: 'Rückstadt',
    country: 'Deutschland',
    countryCode: 'de',
    source: 'geoapify' as const,
  })),
}));

vi.mock('../src/poi.map-geocoding-client.js', () => ({
  getMapGeocodingConfig: () => geocodingState.getConfig(),
  suggestMapAddresses: (input: { query: string }) => geocodingState.suggestAddresses(input),
  reverseMapCoordinates: (input: { latitude: number; longitude: number }) => geocodingState.reverseCoordinates(input),
}));

vi.mock('../src/poi.location-map.js', () => ({
  PoiLocationMap: ({
    onCoordinatesChange,
    onError,
  }: {
    onCoordinatesChange: (coordinates: { latitude: string; longitude: string }) => void;
    onError: (message: string | null) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onCoordinatesChange({ latitude: '50.123456', longitude: '8.654321' })}>
        Kartenpunkt setzen
      </button>
      <button type="button" onClick={() => onError('map_error')}>
        Kartenfehler
      </button>
    </div>
  ),
}));

function TestForm() {
  const methods = useForm<PoiDetailFormValues>({
    defaultValues: createDefaultPoiDetailFormValues(),
  });

  return (
    <FormProvider {...methods}>
      <PoiDetailLocationTab pt={(key) => testTranslations[key] ?? key} />
    </FormProvider>
  );
}

describe('PoiDetailLocationTab', () => {
  beforeEach(() => {
    geocodingState.getConfig.mockClear();
    geocodingState.suggestAddresses.mockClear();
    geocodingState.reverseCoordinates.mockClear();
    registerPluginTranslationResolver((key) => key);
  });

  afterEach(() => {
    cleanup();
  });

  it('searches addresses manually and applies a selected result to the poi form', async () => {
    render(<TestForm />);

    fireEvent.change(screen.getByLabelText('Adresse suchen'), { target: { value: 'Musterstraße 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adresse suchen' }));

    expect(await screen.findByText('Musterstraße 1, 12345 Musterstadt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Musterstraße 1');
      expect((screen.getByLabelText('PLZ') as HTMLInputElement).value).toBe('12345');
      expect((screen.getByLabelText('Ort') as HTMLInputElement).value).toBe('Musterstadt');
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('51.5');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('13.4');
    });
  });

  it('keeps geocoding failures local and manual editing available', async () => {
    geocodingState.suggestAddresses.mockRejectedValueOnce(new Error('disabled'));

    render(<TestForm />);

    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Freie Eingabe 7' } });
    fireEvent.change(screen.getByLabelText('Adresse suchen'), { target: { value: 'Freie Eingabe 7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adresse suchen' }));

    expect(await screen.findByText('Adresssuche nicht verfügbar.')).toBeTruthy();
    expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Freie Eingabe 7');

    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '48.1' } });
    expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('48.1');
  });

  it('resolves coordinates back into address fields without blocking manual editing', async () => {
    render(<TestForm />);

    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '48.1' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '11.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adresse aus Koordinaten übernehmen' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Rückweg 2');
      expect((screen.getByLabelText('PLZ') as HTMLInputElement).value).toBe('54321');
      expect((screen.getByLabelText('Ort') as HTMLInputElement).value).toBe('Rückstadt');
    });
  });

  it('synchronizes coordinates from the map interaction back into the form', async () => {
    render(<TestForm />);

    fireEvent.click(await screen.findByRole('button', { name: 'Kartenpunkt setzen' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('50.123456');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('8.654321');
    });
  });
});
