import type { Route } from '@playwright/test';
import type { WasteFacadeState, WasteTourState } from './waste-management-plugin.helpers';

export async function getTours(route: Route, state: WasteFacadeState): Promise<void> {
  const { settingsState, toursState } = state;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        tours: toursState,
        customRecurrencePresets: settingsState.customRecurrencePresets ?? [],
      },
    }),
  });
  return;
}

export async function updateTourValidity(route: Route, state: WasteFacadeState): Promise<void> {
  const { toursState, requests } = state;
  const request = route.request();
  const body = request.postDataJSON() as {
    tourIds?: string[];
    firstDate?: { mode?: string; value?: string };
    endDate?: { mode?: string; value?: string };
  };
  requests.tourValidityUpdates.push(body);
  const selectedTours = toursState.filter((tour) => body.tourIds?.includes(tour.id));
  const applicable = selectedTours.every(
    (tour) =>
      Boolean(tour.customRecurrenceId) || !['custom', 'on-demand'].includes(tour.recurrence ?? '')
  );
  if (
    selectedTours.length !== body.tourIds?.length ||
    !applicable ||
    body.firstDate?.mode === 'clear'
  ) {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_request', message: 'Ungültige Tourauswahl.' }),
    });
    return;
  }
  for (const tour of selectedTours) {
    if (body.firstDate?.mode === 'set') tour.firstDate = body.firstDate.value;
    if (body.endDate?.mode === 'set') tour.endDate = body.endDate.value;
    if (body.endDate?.mode === 'clear') tour.endDate = undefined;
    tour.updatedAt = '2026-05-10T12:40:00.000Z';
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { updatedCount: selectedTours.length } }),
  });
  return;
}

export async function updateTourStatus(route: Route, state: WasteFacadeState): Promise<void> {
  const { toursState, requests } = state;
  const request = route.request();
  const body = request.postDataJSON() as {
    tourIds?: string[];
    status?: WasteTourState['status'];
  };
  requests.tourStatusUpdates.push(body);
  const selectedTours = toursState.filter((tour) => body.tourIds?.includes(tour.id));
  if (
    selectedTours.length !== body.tourIds?.length ||
    !body.status ||
    !['draft', 'published', 'archived'].includes(body.status)
  ) {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_request', message: 'Ungültige Tourauswahl.' }),
    });
    return;
  }
  for (const tour of selectedTours) {
    tour.status = body.status;
    tour.updatedAt = '2026-05-10T12:45:00.000Z';
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { updatedCount: selectedTours.length } }),
  });
  return;
}

export async function createTour(route: Route, state: WasteFacadeState): Promise<void> {
  const { settingsState, toursState, requests } = state;
  const request = route.request();
  const body = request.postDataJSON() as Record<string, unknown>;
  requests.createdTours.push(body);
  const preset =
    typeof body.customRecurrenceId === 'string'
      ? (settingsState.customRecurrencePresets ?? []).find(
          (candidate) => candidate.id === body.customRecurrenceId
        )
      : undefined;
  const created: WasteTourState = {
    id: String(body.id),
    name: String(body.name),
    wasteFractionIds: Array.isArray(body.wasteFractionIds) ? body.wasteFractionIds.map(String) : [],
    recurrence:
      typeof body.recurrence === 'string'
        ? (body.recurrence as WasteTourState['recurrence'])
        : undefined,
    customRecurrenceId:
      typeof body.customRecurrenceId === 'string' ? body.customRecurrenceId : undefined,
    customRecurrenceName: preset?.name,
    customRecurrenceIntervalDays: preset?.intervalDays,
    firstDate: typeof body.firstDate === 'string' ? body.firstDate : undefined,
    endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
    status: 'draft',
    createdAt: '2026-05-10T12:30:00.000Z',
    updatedAt: '2026-05-10T12:30:00.000Z',
  };
  toursState.unshift(created);
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: created }),
  });
  return;
}
