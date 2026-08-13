import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';

import { createDefaultNewsDetailFormValues } from './news.detail-form.js';
import { NewsDetailTargetingSection } from './news.detail-targeting-tab.js';
import type { NewsDetailFormValues } from './news.types.js';
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

const translate = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  if (
    key === 'targeting.summary.pageStatus' &&
    variables?.page !== undefined &&
    variables.pageCount !== undefined
  ) {
    return `${key}:${variables.page}:${variables.pageCount}`;
  }
  if (variables?.count === undefined) return key;
  return variables.selectedCount === undefined
    ? `${key}:${variables.count}`
    : `${key}:${variables.count}:${variables.selectedCount}`;
};

function Subject({
  masterData = overview,
  initialTargets = [],
  readOnly = false,
}: Readonly<{
  masterData?: WasteManagementMasterDataOverview | null;
  initialTargets?: NewsDetailFormValues['wasteLocationKeys'];
  readOnly?: boolean;
}>) {
  const methods = useForm<NewsDetailFormValues>({
    defaultValues: {
      ...createDefaultNewsDetailFormValues(),
      wasteLocationKeys: initialTargets,
    },
  });
  return (
    <FormProvider {...methods}>
      <NewsDetailTargetingSection overview={masterData} pt={translate} readOnly={readOnly} />
      <output data-testid="dirty-state">{methods.formState.isDirty ? 'dirty' : 'clean'}</output>
    </FormProvider>
  );
}

describe('NewsDetailTargetingTab', () => {
  afterEach(cleanup);

  it('keeps filter-wide draft selection across pages and applies or cancels transactionally', () => {
    render(<Subject />);

    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));
    expect(screen.getByText('targeting.table.selectedCount:0')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('targeting.table.selectionStatus:26:0');
    fireEvent.click(screen.getByLabelText('targeting.actions.selectAll'));
    expect(screen.getByText('targeting.table.selectedCount:26')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('targeting.table.selectionStatus:26:26');
    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }));
    expect(screen.getByText('targeting.mode.global')).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('clean');

    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));
    fireEvent.click(screen.getByLabelText('targeting.actions.selectAll'));
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.next' }));
    expect(screen.getByText('targeting.table.selectedCount:26')).toBeTruthy();
    expect((screen.getByLabelText('targeting.actions.selectAll') as HTMLInputElement).checked).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.apply' }));

    const selectionSummary = screen.getByText('targeting.mode.targeted:26');
    const selectionDetails = selectionSummary.closest('details');
    expect(selectionDetails?.open).toBe(false);
    fireEvent.click(selectionSummary);
    expect(selectionDetails?.open).toBe(true);
    expect(screen.getAllByRole('button', { name: 'targeting.actions.removeTarget' })).toHaveLength(
      25
    );
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.next' }));
    expect(screen.getAllByRole('button', { name: 'targeting.actions.removeTarget' })).toHaveLength(
      1
    );
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('dirty');
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
    expect(
      (screen.getByLabelText('targeting.filters.houseNumber') as HTMLSelectElement).disabled
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('targeting.filters.street'), {
      target: { value: 's1' },
    });
    const houseNumberOptions = Array.from(
      (screen.getByLabelText('targeting.filters.houseNumber') as HTMLSelectElement).options
    ).map((option) => option.text);

    expect(streetOptions).toContain('Hauptstraße — 12345 Musterstadt');
    expect(streetOptions).not.toContain('Parkweg — 54321 Südstadt');
    expect(houseNumberOptions).toContain('1 — Hauptstraße, 12345 Musterstadt');
    expect(houseNumberOptions).not.toContain('9 — Parkweg, 54321 Südstadt');
  });

  it('clears the draft selection when the filters change', () => {
    render(<Subject />);
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));
    fireEvent.change(screen.getByLabelText('targeting.filters.region'), {
      target: { value: 'r1' },
    });
    fireEvent.click(screen.getByLabelText('targeting.actions.selectAll'));
    expect(screen.getByText('targeting.table.selectedCount:26')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('targeting.filters.city'), {
      target: { value: 'c1' },
    });

    expect(screen.getByText('targeting.table.selectedCount:0')).toBeTruthy();
  });

  it('exposes visible filter labels and announces filtered result changes', () => {
    render(<Subject />);
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));

    expect(screen.getByText('targeting.filters.search')).toBeTruthy();
    expect(screen.getByText('targeting.filters.region')).toBeTruthy();
    expect(screen.getByText('targeting.filters.city')).toBeTruthy();
    expect(screen.getByText('targeting.filters.street')).toBeTruthy();
    expect(screen.getByText('targeting.filters.houseNumber')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('targeting.table.selectionStatus');
  });

  it('filters down to a house number and applies an individually selected target', () => {
    render(<Subject />);
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.edit' }));

    fireEvent.change(screen.getByLabelText('targeting.filters.search'), {
      target: { value: 'Hauptstraße' },
    });
    fireEvent.change(screen.getByLabelText('targeting.filters.city'), {
      target: { value: 'c1' },
    });
    fireEvent.change(screen.getByLabelText('targeting.filters.street'), {
      target: { value: 's1' },
    });
    fireEvent.change(screen.getByLabelText('targeting.filters.houseNumber'), {
      target: { value: 'h1' },
    });

    const target = screen.getByLabelText('Hauptstraße 1, 12345 Musterstadt');
    fireEvent.click(target);
    expect((target as HTMLInputElement).checked).toBe(true);
    fireEvent.click(target);
    expect((target as HTMLInputElement).checked).toBe(false);
    fireEvent.click(target);
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.apply' }));

    expect(screen.getByText('targeting.mode.targeted:1')).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('dirty');
  });

  it('navigates from the displayed page after removing the last item on a late page', () => {
    const initialTargets = Array.from({ length: 126 }, (_, index) => ({
      street: `Teststraße ${index + 1}`,
      zip: '12345',
      city: 'Musterstadt',
    }));
    render(<Subject initialTargets={initialTargets} />);
    fireEvent.click(screen.getByText('targeting.mode.targeted:126'));
    expect(screen.getByText('targeting.summary.pageStatus:1:6')).toBeTruthy();

    const nextButton = screen.getByRole('button', { name: 'targeting.actions.next' });
    for (let page = 1; page < 6; page += 1) {
      fireEvent.click(nextButton);
    }
    expect(screen.getByText('6 / 6')).toBeTruthy();
    expect(screen.getByText('targeting.summary.pageStatus:6:6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.removeTarget' }));
    expect(screen.getByText('5 / 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.previous' }));

    expect(screen.getByText('4 / 5')).toBeTruthy();
  });

  it('keeps recipients read-only after the Push has been sent', () => {
    const target = { street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' };
    render(<Subject initialTargets={[target]} readOnly />);

    expect(screen.getByText('targeting.card.sentReadOnly')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'targeting.actions.edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'targeting.actions.removeTarget' })).toBeNull();
    expect(screen.getByTestId('dirty-state').textContent).toBe('clean');
  });

  it('does not mark read-only targets stale before master data has loaded', () => {
    const target = { street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' };
    render(<Subject masterData={null} initialTargets={[target]} readOnly />);

    expect(screen.getByText('Hauptstraße 1, 12345 Musterstadt')).toBeTruthy();
    expect(screen.queryByText('targeting.stale')).toBeNull();
  });

  it('removes a stale target directly from the summary and only marks the form as dirty', () => {
    const staleTarget = { street: 'Alte Straße 7', zip: '12345', city: 'Musterstadt' };

    render(<Subject initialTargets={[staleTarget]} />);

    expect(screen.getByText(/targeting\.stale/)).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('clean');

    fireEvent.click(screen.getByText('targeting.mode.targeted:1'));
    fireEvent.click(screen.getByRole('button', { name: 'targeting.actions.removeTarget' }));

    expect(screen.getByText('targeting.mode.global')).toBeTruthy();
    expect(screen.getByTestId('dirty-state').textContent).toBe('dirty');
    expect(screen.queryByText('Alte Straße 7, 12345 Musterstadt')).toBeNull();
  });
});
