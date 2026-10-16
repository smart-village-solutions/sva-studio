import type { WasteAddressEntityType, WasteAddressImpactCounts, WasteAddressImpactPreview } from '@sva/waste-management-contracts';

export type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
};

export type Row = Readonly<Record<string, unknown>>;
export type AddressSnapshot = Readonly<{
  preview: WasteAddressImpactPreview;
  regionIds: readonly string[];
  cityIds: readonly string[];
  streetIds: readonly string[];
  houseNumberIds: readonly string[];
  locationIds: readonly string[];
  subscriptionIds: readonly string[];
  assignmentIds: readonly string[];
}>;

export const tableByType: Readonly<Record<WasteAddressEntityType, string>> = {
  region: 'waste_regions',
  city: 'waste_cities',
  street: 'waste_streets',
  houseNumber: 'waste_house_numbers',
};
export const parentColumnByType: Readonly<Partial<Record<WasteAddressEntityType, string>>> = {
  city: 'region_id',
  street: 'city_id',
  houseNumber: 'street_id',
};

export const asId = (row: Row): string => String(row.id);
export const ids = (rows: readonly Row[]): readonly string[] => rows.map(asId).sort();
export const unique = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();
export const emptyCounts = (): WasteAddressImpactCounts => ({
  regions: 0,
  cities: 0,
  streets: 0,
  houseNumbers: 0,
  collectionLocations: 0,
  locationTourLinks: 0,
  locationTourPickupDates: 0,
  tourAssignmentLocations: 0,
  fullyRemovedTourAssignments: 0,
  retainedTourAssignments: 0,
  emailReminderSubscriptions: 0,
  emailReminderSubscriptionItems: 0,
  emailReminderOutbox: 0,
  sentEmailReminderOutbox: 0,
  inconsistentCollectionLocations: 0,
});

export const queryRows = async <TRow extends Row = Row>(client: QueryClient, text: string, values: readonly unknown[] = []): Promise<readonly TRow[]> =>
  (await client.query<TRow>(text, values)).rows;

export const lockIds = async (client: QueryClient, table: string, values: readonly string[]) => {
  if (values.length) await queryRows(client, `SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [values]);
};

