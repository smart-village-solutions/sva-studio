import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataLocationFormContent } from '../src/waste-management.master-data-location-form-content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  StudioPageHeader: ({ title, description, actions }: { readonly title: React.ReactNode; readonly description: React.ReactNode; readonly actions: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{actions}</div>
    </header>
  ),
}));

vi.mock('../src/waste-management.master-data-location-assignments.js', () => ({
  LocationAssignmentsSection: () => <div>assignments</div>,
}));

vi.mock('../src/waste-management.master-data-location-form.parts.js', () => ({
  LocationFormActions: ({ cancelLabel, saveLabel, onCancel, saving }: { readonly cancelLabel: string; readonly saveLabel: string; readonly onCancel: () => void; readonly saving: boolean }) => (
    <div>
      <button type="submit" disabled={saving}>
        {saveLabel}
      </button>
      <button type="button" onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  ),
  LocationSelectSection: ({
    form,
    regions,
    filteredCities,
    filteredStreets,
    filteredHouseNumbers,
    onChange,
  }: {
    readonly form: {
      regionId: string;
      cityId: string;
      streetId: string;
      houseNumberId: string;
    };
    readonly regions: readonly { id: string; name: string }[];
    readonly filteredCities: readonly { id: string; name: string }[];
    readonly filteredStreets: readonly { id: string; name: string }[];
    readonly filteredHouseNumbers: readonly { id: string; number: string }[];
    readonly onChange: (patch: Record<string, string>) => void;
  }) => (
    <div>
      <label>
        region
        <select
          aria-label="region"
          name="regionId"
          value={form.regionId}
          onChange={(event) => onChange({ regionId: event.target.value, cityId: '', streetId: '', houseNumberId: '' })}
        >
          <option value="">unset</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        city
        <select
          aria-label="city"
          name="cityId"
          value={form.cityId}
          onChange={(event) => onChange({ cityId: event.target.value, streetId: '', houseNumberId: '' })}
        >
          <option value="">unset</option>
          {filteredCities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        street
        <select
          aria-label="street"
          name="streetId"
          value={form.streetId}
          onChange={(event) => onChange({ streetId: event.target.value, houseNumberId: '' })}
        >
          <option value="">unset</option>
          {filteredStreets.map((street) => (
            <option key={street.id} value={street.id}>
              {street.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        house-number
        <select
          aria-label="house-number"
          name="houseNumberId"
          value={form.houseNumberId}
          onChange={(event) => onChange({ houseNumberId: event.target.value })}
        >
          <option value="">unset</option>
          {filteredHouseNumbers.map((houseNumber) => (
            <option key={houseNumber.id} value={houseNumber.id}>
              {houseNumber.number}
            </option>
          ))}
        </select>
      </label>
    </div>
  ),
  LocationStatusSection: ({ active, onChange }: { readonly active: boolean; readonly onChange: (patch: { active: boolean }) => void }) => (
    <button type="button" onClick={() => onChange({ active: !active })}>
      {active ? 'active' : 'inactive'}
    </button>
  ),
}));

describe('WasteMasterDataLocationFormContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the location form on the RHF path while cascading dependent selections', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <WasteMasterDataLocationFormContent
        mode="edit"
        form={{
          id: 'location-1',
          regionId: 'region-1',
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
        }}
        regions={[{ id: 'region-1', name: 'Nord' }, { id: 'region-2', name: 'Süd' }] as never}
        cities={[
          { id: 'city-1', name: 'Altstadt', regionId: 'region-1' },
          { id: 'city-2', name: 'Neustadt', regionId: 'region-2' },
        ] as never}
        streets={[
          { id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' },
          { id: 'street-2', name: 'Ring', cityId: 'city-2' },
        ] as never}
        houseNumbers={[
          { id: 'house-1', number: '12', streetId: 'street-1' },
          { id: 'house-2', number: '4', streetId: 'street-2' },
        ] as never}
        fractions={[] as never}
        availableTours={[] as never}
        locationTourLinks={[] as never}
        saving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        onReloadAssignments={vi.fn(async () => undefined)}
      />
    );

    fireEvent.change(screen.getByLabelText('region'), {
      target: { value: 'region-2' },
    });

    expect(onChange).toHaveBeenCalledWith({
      regionId: 'region-2',
      cityId: '',
      streetId: '',
      houseNumberId: '',
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'masterData.collectionLocations.actions.save' })[0] as HTMLButtonElement);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('region') as HTMLSelectElement).value).toBe('region-2');
    expect((screen.getByLabelText('city') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('street') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('house-number') as HTMLSelectElement).value).toBe('');
  });
});
