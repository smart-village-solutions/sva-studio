import type { createWasteMasterDataRepository } from '@sva/data-repositories';

export const baselineIds = {
  region: '00000000-0000-4000-8000-000000000001',
  city: '00000000-0000-4000-8000-000000000002',
  street: '00000000-0000-4000-8000-000000000003',
  houseNumber: '00000000-0000-4000-8000-000000000004',
  location: '00000000-0000-4000-8000-000000000005',
  fractionRest: '00000000-0000-4000-8000-000000000006',
  fractionBio: '00000000-0000-4000-8000-000000000007',
  tour: '00000000-0000-4000-8000-000000000008',
  link: '00000000-0000-4000-8000-000000000009',
  tourShift: '00000000-0000-4000-8000-00000000000a',
  globalShift: '00000000-0000-4000-8000-00000000000b',
} as const;

export const seedWasteBaseline = async (repository: ReturnType<typeof createWasteMasterDataRepository>) => {
  await repository.upsertWasteRegion({ id: baselineIds.region, name: 'Musterregion' });
  await repository.upsertWasteCity({ id: baselineIds.city, name: 'Musterstadt', regionId: baselineIds.region });
  await repository.upsertWasteStreet({ id: baselineIds.street, name: 'Hauptstraße', cityId: baselineIds.city });
  await repository.upsertWasteHouseNumber({ id: baselineIds.houseNumber, number: '42', streetId: baselineIds.street });
  await repository.upsertWasteCollectionLocation({
    id: baselineIds.location,
    cityId: baselineIds.city,
    regionId: baselineIds.region,
    streetId: baselineIds.street,
    houseNumberId: baselineIds.houseNumber,
    active: true,
  });
  await repository.upsertWasteFraction({
    id: baselineIds.fractionRest,
    name: 'Restmüll',
    translations: { de: 'Restmüll', en: 'Residual waste' },
    containerSize: '120l',
    color: '#4B5563',
    description: 'Baseline-Fraktion für Seed-Daten',
    active: true,
    reminderCount: 'none',
    firstReminderMaxLeadDays: undefined,
    secondReminderMaxLeadDays: undefined,
    reminderChannelPushEnabled: false,
    reminderChannelEmailEnabled: false,
    reminderChannelCalendarEnabled: false,
  });
  await repository.upsertWasteFraction({
    id: baselineIds.fractionBio,
    name: 'Biotonne',
    translations: { de: 'Biotonne', en: 'Organic waste' },
    containerSize: '120l',
    color: '#16A34A',
    description: 'Baseline-Fraktion für Seed-Daten',
    active: true,
    reminderCount: 'none',
    firstReminderMaxLeadDays: undefined,
    secondReminderMaxLeadDays: undefined,
    reminderChannelPushEnabled: false,
    reminderChannelEmailEnabled: false,
    reminderChannelCalendarEnabled: false,
  });
  await repository.upsertWasteTour({
    id: baselineIds.tour,
    name: 'Baseline-Tour',
    description: 'Automatisch angelegte Seed-Tour',
    wasteFractionIds: [baselineIds.fractionRest, baselineIds.fractionBio],
    recurrence: 'weekly',
    firstDate: '2026-01-12',
    endDate: '2026-12-31',
    customDates: undefined,
    active: true,
  });
  await repository.upsertWasteLocationTourLink({
    id: baselineIds.link,
    locationId: baselineIds.location,
    tourId: baselineIds.tour,
    startDate: '2026-01-12',
    endDate: undefined,
  });
  await repository.upsertWasteTourDateShift({
    id: baselineIds.tourShift,
    tourId: baselineIds.tour,
    originalDate: '2026-04-03',
    actualDate: '2026-04-04',
    hasYear: true,
    reasonType: 'holiday',
    reasonKey: 'good-friday',
    followUpMode: 'propagate-series',
    description: 'Seed-Verschiebung für Feiertagslogik',
  });
  await repository.upsertWasteGlobalDateShift({
    id: baselineIds.globalShift,
    originalDate: '2026-12-25',
    actualDate: '2026-12-24',
    hasYear: true,
    reasonType: 'holiday',
    reasonKey: 'christmas-day',
    description: 'Globale Seed-Verschiebung',
    tourIds: [baselineIds.tour],
  });
};
