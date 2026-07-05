import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GenericItemsGeoCoordinateFields } from '../src/generic-items.geo-map-section.parts.js';

describe('generic items geo coordinate fields', () => {
  it('marks latitude and longitude independently when only one field has an error', () => {
    const onLatitudeChange = vi.fn();
    const onLongitudeChange = vi.fn();
    const pt = (key: string) =>
      ({
        'fields.latitude': 'Breitengrad',
        'fields.longitude': 'Längengrad',
      })[key] ?? key;

    render(
      <GenericItemsGeoCoordinateFields
        latitude="52.5"
        latitudeError="Breitengrad ist ungültig."
        latitudeId="latitude"
        longitude="13.4"
        longitudeId="longitude"
        onLatitudeChange={onLatitudeChange}
        onLongitudeChange={onLongitudeChange}
        pt={pt}
      />
    );

    expect(screen.getByLabelText('Breitengrad').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Breitengrad').getAttribute('aria-describedby')).toBe('latitude-error');
    expect(screen.getByLabelText('Längengrad').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('Längengrad').getAttribute('aria-describedby')).toBeNull();
  });
});
