import { screen } from '@testing-library/react';
import { expect } from 'vitest';

import type {
  PublicWasteCalendarEntry,
  PublicWasteResolvedSelection,
} from '../lib/public-waste-contract.js';
import type {
  FilteredPublicWasteCalendarViewModel,
  PublicWasteCalendarViewModel,
} from '../lib/public-waste-view-model.js';

export const publicWasteSelectionFixture: PublicWasteResolvedSelection = {
  regionId: 'r-1',
  cityId: 'c-1',
  streetId: 's-1',
  houseNumberId: 'h-1',
};

export const publicWasteSelectionSummaryFixture = 'Musterstadt, Hauptstraße 12';
const publicWasteLocationKeyFixture = 'r-1:c-1:s-1:h-1';

export const createPublicWasteCalendarEntryFixture = (
  overrides: Partial<PublicWasteCalendarEntry> = {}
): PublicWasteCalendarEntry => ({
  id: 'pickup-1',
  date: '2026-05-19',
  fractionId: 'bio',
  fractionLabel: 'Bioabfall',
  fractionColor: '#00AA00',
  note: null,
  ...overrides,
});

export const createPublicWasteCalendarModelFixture = (
  overrides: Partial<PublicWasteCalendarViewModel> = {}
): PublicWasteCalendarViewModel => ({
  locationKey: publicWasteLocationKeyFixture,
  nextPickupDate: '2026-05-19',
  listEntries: [createPublicWasteCalendarEntryFixture()],
  monthBuckets: [],
  yearBuckets: [],
  fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
  ...overrides,
});

export const createFilteredPublicWasteCalendarModelFixture = (
  overrides: Partial<FilteredPublicWasteCalendarViewModel> = {}
): FilteredPublicWasteCalendarViewModel => ({
  ...createPublicWasteCalendarModelFixture(),
  activeFractionIds: ['bio'],
  ...overrides,
});

export const expectPublicWasteSelectionHeader = () => {
  expect(screen.getByText('Musterstadt')).toBeTruthy();
  expect(screen.getByText('Hauptstraße')).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
};
