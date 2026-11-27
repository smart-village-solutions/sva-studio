import { listHostMediaReferencesByTarget, type HostMediaReferenceSelection } from '@sva/plugin-sdk';
import type { ContentMediaUsage } from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';

import { audioRole, initialAudio } from './tour-audio-data.js';
import { tourAudioTarget, type EditableTour } from './tour-edit-data.js';

type AudioAssetIds = Readonly<Record<string, string>>;

const lookupAssetIds = (tour: EditableTour, refs: readonly HostMediaReferenceSelection[]) => {
  const audio = initialAudio(tour);
  const usages = [tourAudioTarget, ...tour.tourStops.map(({ id }) => id)].flatMap(
    (key) => audio[key] ?? []
  );
  return Object.fromEntries(
    refs.flatMap((ref) => {
      const usage = ref.sortOrder === undefined ? undefined : usages[ref.sortOrder];
      return ref.role === audioRole && usage ? [[usage.uiId, ref.assetId]] : [];
    })
  );
};

export function useTourAudioReferences(
  tour: EditableTour | undefined,
  canSelect: boolean,
  instanceId?: string
) {
  const [assetIds, setAssetIds] = useState<AudioAssetIds>();
  useEffect(() => {
    if (!tour || !canSelect) return;
    let active = true;
    void listHostMediaReferencesByTarget({
      fetch: globalThis.fetch.bind(globalThis),
      targetType: 'tours.tour',
      targetId: tour.id,
      instanceId,
    }).then(
      (ref) => {
        if (active) setAssetIds(lookupAssetIds(tour, ref));
      },
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [canSelect, instanceId, tour]);

  const withReference = (usage: ContentMediaUsage): ContentMediaUsage => {
    const assetId = assetIds?.[usage.uiId];
    return usage.assetId || !assetId ? usage : { ...usage, assetId };
  };
  const syncNeeded = (usages: readonly ContentMediaUsage[]) => {
    if (!canSelect || (tour && !assetIds)) return false;
    const initial = initialAudio(tour);
    const targets = tour ? [tourAudioTarget, ...tour.tourStops.map(({ id }) => id)] : [];
    const original = targets.flatMap((key) => initial[key] ?? []).map(withReference);
    return JSON.stringify(referenceOrder(original)) !== JSON.stringify(referenceOrder(usages));
  };
  return { ready: !tour || assetIds !== undefined, withReference, syncNeeded };
}

const referenceOrder = (usages: readonly ContentMediaUsage[]) =>
  usages.flatMap(({ assetId }, index) => (assetId ? [[assetId, index]] : []));
