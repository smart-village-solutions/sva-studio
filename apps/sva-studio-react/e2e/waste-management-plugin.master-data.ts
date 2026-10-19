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
        locationTourLinks: [],
      },
    }),
  });
  return;
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
      },
    }),
  });
  return;
}
