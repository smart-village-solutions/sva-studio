import type { WasteCollectionLocationListItem, WasteCollectionLocationPage } from '@sva/core';

import type { SqlExecutor } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import {
  buildCollectionLocationIdsStatement,
  buildCollectionLocationPageStatement,
} from './master-data.collection-location-list.statements.js';

type WasteCollectionLocationPageRow = {
  readonly id: string | null;
  readonly city_id: string | null;
  readonly region_id: string | null;
  readonly street_id: string | null;
  readonly house_number_id: string | null;
  readonly active: boolean | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly region_name: string | null;
  readonly city_name: string | null;
  readonly street_name: string | null;
  readonly house_number: string | null;
  readonly tour_ids: readonly string[] | null;
  readonly tour_names: readonly string[] | null;
  readonly total_count: string | number;
};

const mapPageRow = (row: WasteCollectionLocationPageRow): WasteCollectionLocationListItem => {
  if (
    row.id === null ||
    row.city_id === null ||
    row.active === null ||
    row.created_at === null ||
    row.updated_at === null ||
    row.city_name === null
  ) {
    throw new Error('invalid_waste_collection_location_page_row');
  }
  return {
    id: row.id,
    cityId: row.city_id,
    regionId: row.region_id ?? undefined,
    streetId: row.street_id ?? undefined,
    houseNumberId: row.house_number_id ?? undefined,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    regionName: row.region_name ?? undefined,
    cityName: row.city_name,
    streetName: row.street_name ?? undefined,
    houseNumber: row.house_number ?? undefined,
    tours: (row.tour_ids ?? []).map((id, index) => ({
      id,
      name: row.tour_names?.[index] ?? '',
    })),
  };
};

export const createWasteCollectionLocationListRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  'listWasteCollectionLocationPage' | 'listWasteCollectionLocationIds'
> => ({
  async listWasteCollectionLocationPage(query): Promise<WasteCollectionLocationPage> {
    const result = await executor.execute<WasteCollectionLocationPageRow>(
      buildCollectionLocationPageStatement(query)
    );
    const total = Number(result.rows[0]?.total_count ?? 0);
    return {
      items: result.rows.filter((row) => row.id !== null).map(mapPageRow),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  },
  async listWasteCollectionLocationIds(filter) {
    const result = await executor.execute<{ readonly id: string }>(
      buildCollectionLocationIdsStatement(filter)
    );
    return result.rows.map((row) => row.id);
  },
});

export const wasteCollectionLocationListStatements = {
  listWasteCollectionLocationPage: buildCollectionLocationPageStatement,
  listWasteCollectionLocationIds: buildCollectionLocationIdsStatement,
} as const;
