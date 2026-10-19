import type { WasteAddressEntityType, WasteAddressMutationPreviewInput } from '@sva/waste-management-contracts';
import { parentColumnByType, queryRows, tableByType, type QueryClient, type Row } from './address-mutation-shared.js';
import { loadAddressHierarchy } from './address-mutation-snapshot-data.js';

const types = ['region', 'city', 'street', 'houseNumber'] as const;
const keys = ['regions', 'cities', 'streets', 'houses'] as const;
type Step = Readonly<{ type: WasteAddressEntityType; sourceId: string; targetId: string; parentId?: string }>;
export type AddressMergePlan = Readonly<{
  steps: readonly Step[];
  targetState: readonly Row[];
  merged: number;
  transferred: number;
}>;

// Match only siblings under the already resolved target parent. Postal codes
// distinguish equally named cities; spelling variants are never guessed.
const sameIdentity = (type: WasteAddressEntityType, a: Row, b: Row): boolean =>
  type === 'houseNumber' ? a.number === b.number
    : a.name === b.name && (type !== 'city' || (a.postal_code ?? '') === (b.postal_code ?? ''));

export const buildAddressMergePlan = async (client: QueryClient, input: WasteAddressMutationPreviewInput): Promise<AddressMergePlan> => {
  if (input.mode !== 'delete' || !input.targetEntityId || input.targetEntityId === input.entityId) throw new Error('invalid_address_move');
  const start = types.indexOf(input.entityType);
  const source = await loadAddressHierarchy(client, input.entityType, input.entityId);
  // This also validates that the target exists in the same tenant and has the same type.
  const target = await loadAddressHierarchy(client, input.entityType, input.targetEntityId);
  const sourceRows: Row[][] = [];
  const targetRows: Row[][] = [];
  for (let i = start; i < types.length; i++) {
    sourceRows[i] = [...await queryRows(client, `SELECT * FROM ${tableByType[types[i]]} WHERE id = ANY($1::uuid[]) ORDER BY id`, [source[keys[i]].map((r) => r.id)])];
    targetRows[i] = [...await queryRows(client, `SELECT * FROM ${tableByType[types[i]]} WHERE id = ANY($1::uuid[]) ORDER BY id`, [target[keys[i]].map((r) => r.id)])];
  }
  const targetState: Row[] = targetRows.slice(start).flat();
  // Bind the preview to the ancestors that determine denormalized location references.
  let ancestor = targetRows[start][0];
  for (let i = start; i > 0; i--) {
    const parent = parentColumnByType[types[i]];
    const rows = ancestor?.[parent ?? ''] ? await queryRows(client, `SELECT * FROM ${tableByType[types[i - 1]]} WHERE id = $1::uuid`, [ancestor[parent ?? '']]) : [];
    targetState.push(...rows);
    ancestor = rows[0];
  }
  const steps: Step[] = [{ type: input.entityType, sourceId: input.entityId, targetId: input.targetEntityId }];
  const resolved = new Map<string, string>([[input.entityId, input.targetEntityId]]);
  for (let i = start + 1; i < types.length; i++) {
    const type = types[i];
    const parentColumn = parentColumnByType[type] as string;
    const candidates = [...targetRows[i]];
    for (const row of sourceRows[i]) {
      const parentId = resolved.get(String(row[parentColumn]));
      if (!parentId) throw new Error('address_data_inconsistent');
      const duplicate = candidates.find((candidate) => String(candidate[parentColumn]) === parentId && sameIdentity(type, row, candidate));
      const sourceId = String(row.id);
      const targetId = duplicate ? String(duplicate.id) : sourceId;
      resolved.set(sourceId, targetId);
      steps.push({ type, sourceId, targetId, parentId });
      if (!duplicate) candidates.push({ ...row, [parentColumn]: parentId });
    }
  }
  // Source names/parents and target locations influence duplicate resolution and
  // must invalidate the confirmation if either side changes.
  targetState.push(...sourceRows.slice(start).flat());
  const targetIds = targetRows.slice(start).flat().map((r) => r.id);
  const locations = await queryRows(client, `SELECT * FROM waste_collection_locations WHERE region_id = ANY($1::uuid[]) OR city_id = ANY($1::uuid[]) OR street_id = ANY($1::uuid[]) OR house_number_id = ANY($1::uuid[]) ORDER BY id`, [targetIds]);
  targetState.push(...locations);
  return { steps, targetState, merged: steps.filter((s) => s.sourceId !== s.targetId).length, transferred: steps.filter((s) => s.sourceId === s.targetId).length };
};

const mergeLocation = async (client: QueryClient, sourceId: string, targetId: string): Promise<void> => {
  await client.query(`UPDATE waste_collection_locations t SET active = t.active OR s.active, updated_at = NOW() FROM waste_collection_locations s WHERE t.id = $2::uuid AND s.id = $1::uuid`, [sourceId, targetId]);
  await client.query(`INSERT INTO waste_location_tour_links (location_id, tour_id) SELECT $2::uuid, tour_id FROM waste_location_tour_links s WHERE location_id = $1::uuid AND NOT EXISTS (SELECT 1 FROM waste_location_tour_links t WHERE t.location_id = $2::uuid AND t.tour_id = s.tour_id) GROUP BY tour_id`, [sourceId, targetId]);
  await client.query(`INSERT INTO waste_location_tour_pickup_dates (location_id, tour_id, pickup_date, note) SELECT $2::uuid, tour_id, pickup_date, note FROM waste_location_tour_pickup_dates WHERE location_id = $1::uuid ON CONFLICT (location_id, tour_id, pickup_date) DO UPDATE SET note = CASE WHEN waste_location_tour_pickup_dates.note IS NULL THEN EXCLUDED.note WHEN EXCLUDED.note IS NULL OR waste_location_tour_pickup_dates.note = EXCLUDED.note THEN waste_location_tour_pickup_dates.note ELSE waste_location_tour_pickup_dates.note || E'\n' || EXCLUDED.note END, updated_at = NOW()`, [sourceId, targetId]);
  await client.query(`INSERT INTO waste_tour_assignment_locations (assignment_id, collection_location_id) SELECT assignment_id, $2::uuid FROM waste_tour_assignment_locations WHERE collection_location_id = $1::uuid ON CONFLICT DO NOTHING`, [sourceId, targetId]);
  await client.query('DELETE FROM waste_collection_locations WHERE id = $1::uuid', [sourceId]);
};

export const applyAddressMerge = async (client: QueryClient, plan: AddressMergePlan, locationIds: readonly string[]): Promise<void> => {
  const mappings = new Map(plan.steps.map((s) => [s.sourceId, s.targetId]));
  // Move surviving children before deleting duplicate ancestors.
  for (const step of plan.steps) {
    if (step.sourceId === step.targetId && step.parentId) {
      await client.query(`UPDATE ${tableByType[step.type]} SET ${parentColumnByType[step.type]} = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`, [step.sourceId, step.parentId]);
    }
  }
  for (const locationId of locationIds) {
    const location = (await queryRows(client, 'SELECT * FROM waste_collection_locations WHERE id = $1::uuid', [locationId]))[0];
    if (!location) continue;
    const mapped = (key: string) => mappings.get(String(location[key])) ?? location[key] ?? null;
    const houseId = mapped('house_number_id');
    const streetId = houseId ? (await queryRows(client, 'SELECT street_id FROM waste_house_numbers WHERE id = $1::uuid', [houseId]))[0]?.street_id : mapped('street_id');
    const cityId = streetId ? (await queryRows(client, 'SELECT city_id FROM waste_streets WHERE id = $1::uuid', [streetId]))[0]?.city_id : mapped('city_id');
    const regionId = (await queryRows(client, 'SELECT region_id FROM waste_cities WHERE id = $1::uuid', [cityId]))[0]?.region_id ?? null;
    await client.query('UPDATE waste_collection_locations SET region_id = $2::uuid, city_id = $3::uuid, street_id = $4::uuid, house_number_id = $5::uuid, updated_at = NOW() WHERE id = $1::uuid', [locationId, regionId, cityId, streetId, houseId]);
    const duplicate = (await queryRows(client, `SELECT id FROM waste_collection_locations WHERE id <> $1::uuid AND region_id IS NOT DISTINCT FROM $2::uuid AND city_id = $3::uuid AND street_id IS NOT DISTINCT FROM $4::uuid AND house_number_id IS NOT DISTINCT FROM $5::uuid ORDER BY id LIMIT 1`, [locationId, regionId, cityId, streetId, houseId]))[0];
    if (duplicate) await mergeLocation(client, locationId, String(duplicate.id));
  }
  for (const step of [...plan.steps].reverse()) {
    if (step.sourceId !== step.targetId) await client.query(`DELETE FROM ${tableByType[step.type]} WHERE id = $1::uuid`, [step.sourceId]);
  }
};
