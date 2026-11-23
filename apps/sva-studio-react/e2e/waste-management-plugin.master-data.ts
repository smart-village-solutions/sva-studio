import type { Route } from '@playwright/test';
import type { WasteFacadeState, WasteFractionState } from './waste-management-plugin.helpers';

export async function getHistory(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        audit: {
          items: [],
          total: 0,
        },
        technical: {
          items: [],
          total: 0,
        },
      },
    }),
  });
  return;
}

export async function getMasterData(route: Route, state: WasteFacadeState): Promise<void> {
  const {
    fractionsState,
    regionsState,
    citiesState,
    streetsState,
    houseNumbersState,
    collectionLocationsState,
    locationTourLinksState,
  } = state;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        fractions: fractionsState,
        regions: regionsState,
        cities: citiesState,
        streets: streetsState,
        houseNumbers: houseNumbersState,
        collectionLocations: collectionLocationsState,
        locationTourLinks: locationTourLinksState,
      },
    }),
  });
  return;
}

export async function getLocationList(
  route: Route,
  state: WasteFacadeState,
  selection = false
): Promise<void> {
  const query = new URL(route.request().url()).searchParams;
  const items = state.collectionLocationsState
    .map((item) => ({
      ...item,
      regionName: state.regionsState.find(({ id }) => id === item.regionId)?.name,
      cityName: state.citiesState.find(({ id }) => id === item.cityId)?.name ?? item.cityId,
      streetName: state.streetsState.find(({ id }) => id === item.streetId)?.name,
      houseNumber: state.houseNumbersState.find(({ id }) => id === item.houseNumberId)?.number,
      tours: state.toursState.filter((tour) =>
        state.locationTourLinksState.some(
          (link) => link.locationId === item.id && link.tourId === tour.id
        )
      ),
    }))
    .filter((item) => {
      const addressKeys = ['regionId', 'cityId', 'streetId', 'houseNumberId'] as const;
      const status = query.get('status');
      const tourId = query.get('tourId');
      return (
        addressKeys.every((key) => !query.has(key) || query.get(key) === item[key]) &&
        (status !== 'active' || item.active) &&
        (status !== 'inactive' || !item.active) &&
        (!tourId || item.tours.some(({ id }) => id === tourId))
      );
    });
  if (selection) {
    await route.fulfill({ json: { data: { ids: items.map(({ id }) => id) } } });
    return;
  }
  const page = Number(query.get('page') ?? '1');
  const pageSize = Number(query.get('pageSize') ?? '100');
  const start = (page - 1) * pageSize;
  await route.fulfill({
    json: {
      data: {
        items: items.slice(start, start + pageSize),
        page,
        pageSize,
        total: items.length,
        pageCount: Math.ceil(items.length / pageSize),
      },
    },
  });
}

export async function createFraction(route: Route, state: WasteFacadeState): Promise<void> {
  const { input, fractionsState, requests } = state;
  const request = route.request();
  if (input.allowFractionCreate === false) {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'forbidden', message: 'Keine Berechtigung.' }),
    });
    return;
  }
  const body = request.postDataJSON() as Record<string, unknown>;
  requests.createdFractions.push(body);
  const created: WasteFractionState = {
    id: String(body.id),
    name: String(body.name),
    color: String(body.color),
    containerSize: typeof body.containerSize === 'string' ? body.containerSize : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    active: body.active !== false,
    createdAt: '2026-05-10T12:15:00.000Z',
    updatedAt: '2026-05-10T12:15:00.000Z',
  };
  fractionsState.unshift(created);
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: created }),
  });
  return;
}

export async function getScheduling(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        globalDateShifts: [],
        tourDateShifts: [],
        locationTourPickupDates: [],
      },
    }),
  });
  return;
}

const storeLink = (
  state: WasteFacadeState,
  link: { id: string; locationId: string; tourId: string }
) => {
  const timestamps = {
    createdAt: '2026-05-10T12:15:00.000Z',
    updatedAt: '2026-05-10T12:15:00.000Z',
  };
  const record = { ...link, ...timestamps };
  state.locationTourLinksState.push(record);
  return record;
};

export async function createLocationTourLink(route: Route, state: WasteFacadeState) {
  const { id, locationId, tourId } = route.request().postDataJSON() as {
    id: string;
    locationId: string;
    tourId: string;
  };
  const data = storeLink(state, { id, locationId, tourId });
  await route.fulfill({ status: 201, json: { data } });
}

export async function createLocationTourLinksBulk(route: Route, state: WasteFacadeState) {
  const { locationIds, tourId } = route.request().postDataJSON() as {
    locationIds: string[];
    tourId: string;
  };
  const items = locationIds.map((locationId) =>
    storeLink(state, { id: `link-${tourId}-${locationId}`, locationId, tourId })
  );
  await route.fulfill({ status: 201, json: { data: { createdCount: items.length, items } } });
}

export async function deleteLocationTourLink(route: Route, state: WasteFacadeState, id: string) {
  const index = state.locationTourLinksState.findIndex((link) => link.id === id);
  if (index === -1) {
    await route.fulfill({ status: 404, json: { error: 'not_found' } });
    return;
  }
  state.locationTourLinksState.splice(index, 1);
  await route.fulfill({ status: 200, json: { data: { id } } });
}
