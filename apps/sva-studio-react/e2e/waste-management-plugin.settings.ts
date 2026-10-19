import type { Route } from '@playwright/test';
import type {
  WasteFacadeState,
  WasteTourState,
  WasteCustomRecurrencePresetState,
} from './waste-management-plugin.helpers';

export async function getSettings(route: Route, state: WasteFacadeState): Promise<void> {
  const { settingsState } = state;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: settingsState }),
  });
  return;
}

export async function updateSettings(route: Route, state: WasteFacadeState): Promise<void> {
  const { settingsState, toursState, requests } = state;
  const request = route.request();
  const body = request.postDataJSON() as Record<string, unknown>;
  requests.settingsUpdates.push(body);
  settingsState.projectUrl = String(body.projectUrl ?? settingsState.projectUrl);
  settingsState.schemaName = String(body.schemaName ?? settingsState.schemaName);
  settingsState.enabled = body.enabled !== false;
  settingsState.databaseUrlConfigured = true;
  settingsState.serviceRoleKeyConfigured = true;
  settingsState.visibleStatus = 'ok';
  settingsState.lastCheckedAt = '2026-05-10T12:20:00.000Z';
  const nextPresets = Array.isArray(body.customRecurrencePresets)
    ? body.customRecurrencePresets.map((preset) => {
        const currentPreset = (settingsState.customRecurrencePresets ?? []).find(
          (candidate) => candidate.id === String((preset as Record<string, unknown>).id)
        );
        return {
          id: String((preset as Record<string, unknown>).id),
          name: String((preset as Record<string, unknown>).name),
          description:
            typeof (preset as Record<string, unknown>).description === 'string'
              ? String((preset as Record<string, unknown>).description)
              : undefined,
          intervalDays: Number((preset as Record<string, unknown>).intervalDays),
          createdAt: currentPreset?.createdAt ?? '2026-05-10T12:20:00.000Z',
          updatedAt: '2026-05-10T12:20:00.000Z',
        } satisfies WasteCustomRecurrencePresetState;
      })
    : (settingsState.customRecurrencePresets ?? []);
  const nextPresetMap = new Map(nextPresets.map((preset) => [preset.id, preset] as const));
  const deletedPresetFallbacks =
    typeof body.deletedPresetFallbacks === 'object' && body.deletedPresetFallbacks
      ? (body.deletedPresetFallbacks as Record<string, { kind?: string; value?: string }>)
      : {};

  for (const tour of toursState) {
    if (!tour.customRecurrenceId) {
      continue;
    }
    const resolvedPreset = nextPresetMap.get(tour.customRecurrenceId);
    if (resolvedPreset) {
      tour.customRecurrenceName = resolvedPreset.name;
      tour.customRecurrenceIntervalDays = resolvedPreset.intervalDays;
      continue;
    }

    const fallback = deletedPresetFallbacks[tour.customRecurrenceId];
    if (!fallback) {
      tour.customRecurrenceId = undefined;
      tour.customRecurrenceName = undefined;
      tour.customRecurrenceIntervalDays = undefined;
      continue;
    }

    if (fallback.kind === 'preset') {
      const fallbackPreset = nextPresetMap.get(String(fallback.value));
      tour.customRecurrenceId = fallbackPreset?.id;
      tour.customRecurrenceName = fallbackPreset?.name;
      tour.customRecurrenceIntervalDays = fallbackPreset?.intervalDays;
      tour.recurrence = undefined;
      continue;
    }

    tour.customRecurrenceId = undefined;
    tour.customRecurrenceName = undefined;
    tour.customRecurrenceIntervalDays = undefined;
    tour.recurrence = String(fallback.value) as WasteTourState['recurrence'];
  }

  settingsState.customRecurrencePresets = nextPresets;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: settingsState }),
  });
  return;
}
