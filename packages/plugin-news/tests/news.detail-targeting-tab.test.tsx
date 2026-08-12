import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';

import { createDefaultNewsDetailFormValues } from '../src/news.detail-form.js';
import { NewsDetailTargetingSection } from '../src/news.detail-targeting-tab.js';
import type { NewsDetailFormValues } from '../src/news.types.js';
import type { WasteManagementMasterDataOverview } from '@sva/plugin-sdk';

const timestamp = '2026-08-12T10:00:00.000Z';
const houseNumbers = Array.from({ length: 26 }, (_, index) => ({
  id: `h${index + 1}`,
  number: String(index + 1),
  streetId: 's1',
  createdAt: timestamp,
  updatedAt: timestamp,
}));
const overview = {
  fractions: [],
  regions: [{ id: 'r1', name: 'Nord', createdAt: timestamp, updatedAt: timestamp }],
  cities: [
    {
      id: 'c1',
      name: 'Musterstadt',
      postalCode: '12345',
      regionId: 'r1',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  streets: [
    { id: 's1', name: 'Hauptstraße', cityId: 'c1', createdAt: timestamp, updatedAt: timestamp },
  ],
  houseNumbers,
  collectionLocations: houseNumbers.map((houseNumber) => ({
    id: `l${houseNumber.id}`,
    cityId: 'c1',
    regionId: 'r1',
    streetId: 's1',
    houseNumberId: houseNumber.id,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  })),
  locationTourLinks: [],
} as const;

const translate = (key: string, variables?: Readonly<Record<string, string | number>>) =>
  variables?.count === undefined ? key : `${key}:${variables.count}`;

function Subject({
  masterData = overview,
  initialTargets = [],
}: Readonly<{
  masterData?: WasteManagementMasterDataOverview;
  initialTargets?: NewsDetailFormValues['wasteLocationKeys'];
}>) {
  const methods = useForm<NewsDetailFormValues>({
    defaultValues: {
      ...createDefaultNewsDetailFormValues(),
      wasteLocationKeys: initialTargets,
    },
  });
  return (
    <FormProvider {...methods}>
      <NewsDetailTargetingSection overview={masterData} pt={translate} />
      <output data-testid="dirty-state">{methods.formState.isDirty ? 'dirty' : 'clean'}</output>
    </FormProvider>
  );
}

describe('NewsDetailTargetingTab', () => {
  afterEach(cleanup);

  it('keeps filter-wide draft selection across pages and applies or cancels transactionally', () => {
    render(<Subject />);

    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));
    fireEvent.click(screen.getByLabelText('targeting.actions.selectAll'));
    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }));
    expect(screen.getByText('targeting.mode.global')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));
    fireEvent.click(screen.getByLabelText('targeting.actions.selectAll'));
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.next' }));
    expect((screen.getByLabelText('targeting.actions.selectAll') as HTMLInputElement).checked).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.apply' }));

    expect(screen.getByText('targeting.mode.targeted:26')).toBeTruthy();
  });

  it('cascades region filters into streets and house numbers and labels their parent context', () => {
    const hierarchicalOverview: WasteManagementMasterDataOverview = {
      ...overview,
      regions: [
        ...overview.regions,
        { id: 'r2', name: 'Süd', createdAt: timestamp, updatedAt: timestamp },
      ],
      cities: [
        ...overview.cities,
        {
          id: 'c2',
          name: 'Südstadt',
          postalCode: '54321',
          regionId: 'r2',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      streets: [
        ...overview.streets,
        { id: 's2', name: 'Parkweg', cityId: 'c2', createdAt: timestamp, updatedAt: timestamp },
      ],
      houseNumbers: [
        ...overview.houseNumbers,
        { id: 'h-south', number: '9', streetId: 's2', createdAt: timestamp, updatedAt: timestamp },
      ],
      collectionLocations: [
        ...overview.collectionLocations,
        {
          id: 'l-south',
          cityId: 'c2',
          regionId: 'r2',
          streetId: 's2',
          houseNumberId: 'h-south',
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    };

    render(<Subject masterData={hierarchicalOverview} />);
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));
    fireEvent.change(screen.getByLabelText('targeting.filters.region'), {
      target: { value: 'r1' },
    });

    const streetOptions = Array.from(
      (screen.getByLabelText('targeting.filters.street') as HTMLSelectElement).options
    ).map((option) => option.text);
    const houseNumberOptions = Array.from(
      (screen.getByLabelText('targeting.filters.houseNumber') as HTMLSelectElement).options
    ).map((option) => option.text);

    expect(streetOptions).toContain('Hauptstraße — 12345 Musterstadt');
    expect(streetOptions).not.toContain('Parkweg — 54321 Südstadt');
    expect(houseNumberOptions).toContain('1 — Hauptstraße, 12345 Musterstadt');
    expect(houseNumberOptions).not.toContain('9 — Parkweg, 54321 Südstadt');
  });

  it('removes a stale target directly from the summary and only marks the form as dirty', () => {
    const staleTarget = { street: 'Alte Straße 7', zip: '12345', city: 'Musterstadt' };

    render(<Subject initialTargets={[staleTarget]} />);

    expect(screen.getByText(/targeting\.stale/)).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('clean');

    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.removeTarget' }));

    expect(screen.getByText('targeting.mode.global')).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('dirty');
    expect(screen.queryByText('Alte Straße 7, 12345 Musterstadt')).toBeNull();
  });
});
