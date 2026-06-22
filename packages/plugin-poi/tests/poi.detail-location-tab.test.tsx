import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultPoiDetailFormValues, type PoiDetailFormValues } from '../src/poi.detail-form.js';
import { PoiDetailLocationTab } from '../src/poi.detail-location-tab.js';

const testTranslations: Record<string, string> = {
  'cards.location.address.title': 'Lage und Adresse',
  'cards.location.address.description': 'Adressdaten, Karte und Koordinaten',
  'fields.street': 'Straße',
  'fields.zip': 'PLZ',
  'fields.city': 'Ort',
  'fields.locationName': 'Ortsbezeichnung',
  'fields.latitude': 'Breitengrad',
  'fields.longitude': 'Längengrad',
  'actions.geocodeAddress': 'Geo-Koordinaten ermitteln',
  'actions.geocodingAddress': 'Geo-Koordinaten werden ermittelt',
  'actions.reverseGeocodeAddress': 'Adresse ermitteln',
  'actions.reverseGeocodingAddress': 'Adresse wird ermittelt',
  'messages.locationGeocodeError': 'Geo-Koordinaten nicht verfügbar.',
  'messages.locationGeocodeEmpty': 'Keine Geo-Koordinaten gefunden.',
  'messages.locationMapUnavailable': 'Karte deaktiviert.',
  'messages.locationMapError': 'Karte nicht verfügbar.',
};

const geocodingState = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({
    provider: 'geoapify' as const,
    styleUrl: 'https://tileserver.example/style.json',
    autocompleteEnabled: false,
    geocodeEnabled: true,
    reverseGeocodeEnabled: true,
    killSwitchEnabled: false,
  })),
  geocodeAddress: vi.fn(async () => ({
    label: 'Rathausplatz, 12345 Musterstadt',
    coordinates: { latitude: 48.1, longitude: 11.5 },
    street: 'Andere Straße',
    houseNumber: '99',
    postalCode: '54321',
    city: 'Anderstadt',
    country: 'Deutschland',
    countryCode: 'de',
    source: 'geoapify' as const,
  })),
  reverseCoordinates: vi.fn(async () => ({
    label: 'Gefundene Adresse',
    coordinates: { latitude: 48.1, longitude: 11.5 },
    street: 'Neue Straße',
    houseNumber: '5',
    postalCode: '54321',
    city: 'Neustadt',
    country: 'Deutschland',
    countryCode: 'de',
    source: 'geoapify' as const,
  })),
}));

vi.mock('../src/poi.map-geocoding-client.js', () => ({
  getMapGeocodingConfig: () => geocodingState.getConfig(),
  geocodeMapAddress: (input: {
    address: { query?: string; street?: string; zip?: string; city?: string; country?: string };
  }) => geocodingState.geocodeAddress(input),
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
    geocodingState.geocodeAddress.mockClear();
    geocodingState.reverseCoordinates.mockClear();
    registerPluginTranslationResolver((key) => key);
  });

  afterEach(() => {
    cleanup();
  });

  it('does not trigger geocoding requests when location fields are only edited manually', async () => {
    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: 'Geo-Koordinaten ermitteln' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Freie Eingabe 7' } });
    fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '48.1' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '11.5' } });

    expect(screen.getByRole('button', { name: 'Geo-Koordinaten ermitteln' })).toBeTruthy();

    expect(geocodingState.geocodeAddress).not.toHaveBeenCalled();
    expect(geocodingState.reverseCoordinates).not.toHaveBeenCalled();
  });

  it('geocodes the entered address explicitly and applies only the coordinates to the form', async () => {
    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Ortsbezeichnung'), { target: { value: 'Rathaus' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Marktplatz 1' } });
    fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });

    const geocodeButton = await screen.findByRole('button', { name: 'Geo-Koordinaten ermitteln' });
    fireEvent.click(geocodeButton);

    await waitFor(() => {
      expect((screen.getByLabelText('Ortsbezeichnung') as HTMLInputElement).value).toBe('Rathaus');
      expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Marktplatz 1');
      expect((screen.getByLabelText('PLZ') as HTMLInputElement).value).toBe('12345');
      expect((screen.getByLabelText('Ort') as HTMLInputElement).value).toBe('Musterstadt');
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('48.1');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('11.5');
    });
    expect(geocodingState.geocodeAddress).toHaveBeenCalledWith({
      address: {
        query: 'Rathaus',
        street: 'Marktplatz 1',
        zip: '12345',
        city: 'Musterstadt',
        country: 'Deutschland',
      },
    });
  });

  it('synchronizes coordinates from the map interaction back into the form', async () => {
    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Kartenpunkt setzen' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('50.123456');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('8.654321');
    });
  });

  it('reverse geocodes existing coordinates and overwrites the address fields', async () => {
    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Ortsbezeichnung'), { target: { value: 'Bleibt gleich' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Alte Straße 1' } });
    fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '11111' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Altstadt' } });
    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '48.100000' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '11.500000' } });

    fireEvent.click(await screen.findByRole('button', { name: 'Adresse ermitteln' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Ortsbezeichnung') as HTMLInputElement).value).toBe('Bleibt gleich');
      expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Neue Straße 5');
      expect((screen.getByLabelText('PLZ') as HTMLInputElement).value).toBe('54321');
      expect((screen.getByLabelText('Ort') as HTMLInputElement).value).toBe('Neustadt');
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('48.100000');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('11.500000');
    });

    expect(geocodingState.reverseCoordinates).toHaveBeenCalledWith({
      latitude: 48.1,
      longitude: 11.5,
    });
  });
});
