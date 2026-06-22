import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultPoiDetailFormValues, type PoiDetailFormValues } from '../src/poi.detail-form.js';
import { PoiDetailOperatorTab } from '../src/poi.detail-operator-tab.js';

const translations: Record<string, string> = {
  'cards.operator.details.title': 'Betreiber',
  'cards.operator.details.description': 'Betriebsdaten',
  'fields.operatorName': 'Name des Betreibers',
  'fields.email': 'E-Mail',
  'fields.firstName': 'Vorname',
  'fields.lastName': 'Nachname',
  'fields.phone': 'Telefon',
  'fields.fax': 'Fax',
  'fields.url': 'URL',
  'fields.urlDescription': 'Link-Beschreibung',
  'fields.locationName': 'Ortsbezeichnung',
  'fields.street': 'Straße',
  'fields.zip': 'PLZ',
  'fields.city': 'Ort',
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
    label: 'Betreiberhaus, 12345 Musterstadt',
    coordinates: { latitude: 48.2, longitude: 11.6 },
    street: 'Andere Straße',
    houseNumber: '9',
    postalCode: '54321',
    city: 'Anderstadt',
    country: 'Deutschland',
    countryCode: 'de',
    source: 'geoapify' as const,
  })),
  reverseCoordinates: vi.fn(async () => ({
    label: 'Gefundene Adresse',
    coordinates: { latitude: 48.2, longitude: 11.6 },
    street: 'Neue Straße',
    houseNumber: '7',
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
    defaultValues: {
      ...createDefaultPoiDetailFormValues(),
      content: {
        ...createDefaultPoiDetailFormValues().content,
        operator: {
          name: '',
          address: {
            addition: '',
            street: '',
            zip: '',
            city: '',
            geoLocation: { latitude: '', longitude: '' },
          },
          contact: {
            email: '',
            firstName: '',
            lastName: '',
            phone: '',
            fax: '',
            webUrls: [{ url: '', description: '' }],
          },
        },
      },
    },
  });

  return (
    <FormProvider {...methods}>
      <PoiDetailOperatorTab pt={(key) => translations[key] ?? key} />
    </FormProvider>
  );
}

describe('PoiDetailOperatorTab', () => {
  beforeEach(() => {
    geocodingState.getConfig.mockClear();
    geocodingState.geocodeAddress.mockClear();
    geocodingState.reverseCoordinates.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('geocodes the entered operator address and keeps the visible address fields stable', async () => {
    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Ortsbezeichnung'), { target: { value: 'Rathaus' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Marktplatz 1' } });
    fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Geo-Koordinaten ermitteln' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('48.2');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('11.6');
    });

    expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Marktplatz 1');
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

  it('reverse geocodes operator coordinates, updates the address and syncs map interactions', async () => {
    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '48.200000' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '11.600000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adresse ermitteln' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('Neue Straße 7');
      expect((screen.getByLabelText('PLZ') as HTMLInputElement).value).toBe('54321');
      expect((screen.getByLabelText('Ort') as HTMLInputElement).value).toBe('Neustadt');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Kartenpunkt setzen' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Breitengrad') as HTMLInputElement).value).toBe('50.123456');
      expect((screen.getByLabelText('Längengrad') as HTMLInputElement).value).toBe('8.654321');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Kartenfehler' }));
    expect(screen.getByText('Karte nicht verfügbar.')).toBeTruthy();
  });

  it('falls back to the unavailable-map state when the geocoding config cannot be loaded', async () => {
    geocodingState.getConfig.mockRejectedValueOnce(new Error('config unavailable'));

    render(<TestForm />);

    await waitFor(() => {
      expect(screen.getByText('Karte deaktiviert.')).toBeTruthy();
    });
  });

  it('surfaces empty and generic geocoding failures for operator lookups', async () => {
    geocodingState.geocodeAddress.mockRejectedValueOnce(new Error('no_result')).mockRejectedValueOnce(new Error('boom'));
    geocodingState.reverseCoordinates.mockRejectedValueOnce(new Error('no_result'));

    render(<TestForm />);
    await waitFor(() => {
      expect(geocodingState.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Geo-Koordinaten ermitteln' }));

    await waitFor(() => {
      expect(screen.getByText('Keine Geo-Koordinaten gefunden.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Geo-Koordinaten ermitteln' }));

    await waitFor(() => {
      expect(screen.getByText('Geo-Koordinaten nicht verfügbar.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '48.200000' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '11.600000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adresse ermitteln' }));

    await waitFor(() => {
      expect(screen.getByText('Keine Geo-Koordinaten gefunden.')).toBeTruthy();
    });
  });
});
