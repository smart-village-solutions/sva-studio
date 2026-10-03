import type {
  WasteCustomRecurrencePresetRecord,
  WasteTourRecord,
  WasteTourRecurrence,
} from '@sva/waste-management-contracts';
import type { SaveWasteCustomRecurrencePresetsInput } from './handlers/custom-recurrence-deps.js';
import type { WasteRepository } from './server-loaders.context.js';
import type { WasteLoaderContext } from './server-loaders.context.js';

export class WasteRecurrenceLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  wasteDefaultTourRecurrenceValues = new Set<WasteTourRecurrence>([
    'weekly',
    'biweekly',
    'fourweekly',
    'yearly',
    'on-demand',
    'custom',
  ]);

  isWasteTourRecurrence = (value: string): value is WasteTourRecurrence =>
    this.wasteDefaultTourRecurrenceValues.has(value as WasteTourRecurrence);

  listWasteToursForCustomRecurrencePresets = async (
    repository: WasteRepository,
    instanceId: string
  ): Promise<readonly WasteTourRecord[]> =>
    this.context.measureWasteRepositoryStep(
      instanceId,
      'save_waste_custom_recurrence_presets',
      'list_waste_tours',
      () => repository.listWasteTours()
    );

  assertDeletedPresetFallback = ({
    presetId,
    fallback,
    nextPresetMap,
  }: {
    readonly presetId: string;
    readonly fallback:
      SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'][string] | undefined;
    readonly nextPresetMap: ReadonlyMap<
      string,
      Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
    >;
  }): void => {
    if (!fallback) {
      throw new Error(`custom_recurrence_fallback_required:${presetId}`);
    }

    if (fallback.kind === 'preset') {
      if (!nextPresetMap.has(fallback.value)) {
        throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
      }
      return;
    }

    if (!this.isWasteTourRecurrence(fallback.value)) {
      throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
    }
  };

  validateDeletedPresetFallbacks = ({
    tours,
    deletedPresetIds,
    deletedPresetFallbacks,
    nextPresetMap,
  }: {
    readonly tours: readonly WasteTourRecord[];
    readonly deletedPresetIds: readonly string[];
    readonly deletedPresetFallbacks: SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'];
    readonly nextPresetMap: ReadonlyMap<
      string,
      Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
    >;
  }): void => {
    for (const presetId of deletedPresetIds) {
      const hasAffectedTours = tours.some((tour) => tour.customRecurrenceId === presetId);
      if (!hasAffectedTours) {
        continue;
      }

      this.assertDeletedPresetFallback({
        presetId,
        fallback: deletedPresetFallbacks[presetId],
        nextPresetMap,
      });
    }
  };

  reassignToursToFallback = async ({
    repository,
    instanceId,
    presetId,
    fallback,
    affectedTours,
    nextPresetMap,
  }: {
    readonly repository: WasteRepository;
    readonly instanceId: string;
    readonly presetId: string;
    readonly fallback: NonNullable<
      SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'][string]
    >;
    readonly affectedTours: readonly WasteTourRecord[];
    readonly nextPresetMap: ReadonlyMap<
      string,
      Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
    >;
  }): Promise<void> => {
    if (fallback.kind === 'preset') {
      const fallbackPreset = nextPresetMap.get(fallback.value);
      if (!fallbackPreset) {
        throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
      }

      for (const tour of affectedTours) {
        await this.context.measureWasteRepositoryStep(
          instanceId,
          'save_waste_custom_recurrence_presets',
          'reassign_waste_tour_custom_recurrence_preset',
          () =>
            repository.upsertWasteTour({
              ...tour,
              recurrence: null,
              customRecurrenceId: fallbackPreset.id,
              customRecurrenceName: fallbackPreset.name,
              customRecurrenceIntervalDays: fallbackPreset.intervalDays,
            })
        );
      }
      return;
    }

    if (!this.isWasteTourRecurrence(fallback.value)) {
      throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
    }
    const fallbackRecurrence: WasteTourRecurrence = fallback.value;

    for (const tour of affectedTours) {
      await this.context.measureWasteRepositoryStep(
        instanceId,
        'save_waste_custom_recurrence_presets',
        'reassign_waste_tour_default_recurrence',
        () =>
          repository.upsertWasteTour({
            ...tour,
            recurrence: fallbackRecurrence,
            customRecurrenceId: undefined,
            customRecurrenceName: undefined,
            customRecurrenceIntervalDays: undefined,
          })
      );
    }
  };

  applyDeletedCustomRecurrencePresets = async ({
    repository,
    instanceId,
    deletedPresetIds,
    deletedPresetFallbacks,
    nextPresetMap,
  }: {
    readonly repository: WasteRepository;
    readonly instanceId: string;
    readonly deletedPresetIds: readonly string[];
    readonly deletedPresetFallbacks: SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'];
    readonly nextPresetMap: ReadonlyMap<
      string,
      Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
    >;
  }): Promise<void> => {
    if (deletedPresetIds.length === 0) {
      return;
    }

    const tours = await this.listWasteToursForCustomRecurrencePresets(repository, instanceId);

    for (const presetId of deletedPresetIds) {
      const affectedTours = tours.filter((tour) => tour.customRecurrenceId === presetId);
      if (affectedTours.length > 0) {
        const fallback = deletedPresetFallbacks[presetId];
        this.assertDeletedPresetFallback({ presetId, fallback, nextPresetMap });
        await this.reassignToursToFallback({
          repository,
          instanceId,
          presetId,
          fallback,
          affectedTours,
          nextPresetMap,
        });
      }

      await this.context.measureWasteRepositoryStep(
        instanceId,
        'save_waste_custom_recurrence_presets',
        'delete_waste_custom_recurrence_preset',
        () => repository.deleteWasteCustomRecurrencePreset(presetId)
      );
    }
  };

  saveWasteCustomRecurrencePresets = async (
    instanceId: string,
    input: SaveWasteCustomRecurrencePresetsInput
  ): Promise<void> =>
    this.context.withWasteRepository(
      instanceId,
      'save_waste_custom_recurrence_presets',
      async (repository) => {
        const currentPresets = await this.context.measureWasteRepositoryStep(
          instanceId,
          'save_waste_custom_recurrence_presets',
          'list_waste_custom_recurrence_presets',
          () => repository.listWasteCustomRecurrencePresets()
        );
        const currentPresetIds = new Set(currentPresets.map((preset) => preset.id));
        const nextPresetMap = new Map<
          string,
          Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
        >(input.nextItems.map((preset) => [preset.id, preset]));
        const deletedPresetIds = [...currentPresetIds].filter(
          (presetId) => !nextPresetMap.has(presetId)
        );

        if (deletedPresetIds.length > 0) {
          this.validateDeletedPresetFallbacks({
            tours: await this.listWasteToursForCustomRecurrencePresets(repository, instanceId),
            deletedPresetIds,
            deletedPresetFallbacks: input.deletedPresetFallbacks,
            nextPresetMap,
          });
        }

        for (const preset of input.nextItems) {
          await this.context.measureWasteRepositoryStep(
            instanceId,
            'save_waste_custom_recurrence_presets',
            'upsert_waste_custom_recurrence_preset',
            () => repository.upsertWasteCustomRecurrencePreset(preset)
          );
        }

        await this.applyDeletedCustomRecurrencePresets({
          repository,
          instanceId,
          deletedPresetIds,
          deletedPresetFallbacks: input.deletedPresetFallbacks,
          nextPresetMap,
        });
      }
    );
}
