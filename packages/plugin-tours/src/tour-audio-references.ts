import { listHostMediaReferencesByTarget, type HostMediaReferenceSelection } from '@sva/plugin-sdk';
import type { ContentMediaUsage } from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';

import { audioRole, initialAudio } from './tour-audio-data.js';
import { tourAudioTarget, type EditableTour } from './tour-edit-data.js';

type AudioAssetIds = Readonly<Record<string, string>>;
type LookupResult = { key: string; references: readonly HostMediaReferenceSelection[] | null };

const hasOwnAudio = (tour?: EditableTour): boolean =>
  Boolean(
    tour?.mediaContents?.length || tour?.tourStops.some((stop) => stop.mediaContents?.length)
  );

const lookupAssetIds = (
  tour: EditableTour,
  refs: readonly HostMediaReferenceSelection[]
): AudioAssetIds => {
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
  const [result, setResult] = useState<LookupResult>();
  const [attempt, setAttempt] = useState(0);
  const needsLookup = hasOwnAudio(tour);
  const key = JSON.stringify([instanceId, tour?.id, tour?.revision, attempt]);
  useEffect(() => {
    if (!tour || !canSelect || !needsLookup) return;
    let active = true;
    void listHostMediaReferencesByTarget({
      fetch: globalThis.fetch.bind(globalThis),
      targetType: 'tours.tour',
      targetId: tour.id,
      instanceId,
    }).then(
      (ref) => {
        if (active) setResult({ key, references: ref });
      },
      () => {
        if (active) setResult({ key, references: null });
      }
    );
    return () => {
      active = false;
    };
  }, [canSelect, instanceId, key, needsLookup, tour]);

  return {
    ...buildAudioReferences(tour, canSelect, result?.key === key ? result.references : undefined),
    retry: () => setAttempt((value) => value + 1),
  };
}

export const buildAudioReferences = (
  tour: EditableTour | undefined,
  canSelect: boolean,
  references?: readonly HostMediaReferenceSelection[] | null
) => {
  const status = referenceStatus(hasOwnAudio(tour), canSelect, references);
  const assetIds = canSelect && tour && references ? lookupAssetIds(tour, references) : {};
  const withReference = (usage: ContentMediaUsage): ContentMediaUsage => {
    const assetId = assetIds[usage.uiId];
    return usage.assetId || !assetId ? usage : { ...usage, assetId };
  };
  const syncNeeded = (usages: readonly ContentMediaUsage[]) => {
    if (!canSelect || status !== 'ready') return false;
    const initial = initialAudio(tour);
    const targets = tour ? [tourAudioTarget, ...tour.tourStops.map(({ id }) => id)] : [];
    const original = targets.flatMap((key) => initial[key] ?? []).map(withReference);
    return JSON.stringify(referenceOrder(original)) !== JSON.stringify(referenceOrder(usages));
  };
  return { status, withReference, syncNeeded };
};

const referenceStatus = (
  needsLookup: boolean,
  canSelect: boolean,
  references?: readonly HostMediaReferenceSelection[] | null
) => {
  if (!needsLookup) return 'ready';
  if (!canSelect) return 'unavailable';
  if (references) return 'ready';
  return references === null ? 'error' : 'loading';
};

const referenceOrder = (usages: readonly ContentMediaUsage[]) =>
  usages.flatMap(({ assetId }, index) => (assetId ? [[assetId, index]] : []));
