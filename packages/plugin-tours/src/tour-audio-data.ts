import { resolveContentMediaUsageDrafts, type ContentMediaUsage } from '@sva/studio-ui-react';
import {
  tourAudioTarget,
  type EditableTour,
  type TourAudio,
  type TourAudioByTarget,
} from './tour-edit-data.js';

export type AudioUsages = Readonly<Record<string, readonly ContentMediaUsage[]>>;
type DraftResolutions = Parameters<typeof resolveContentMediaUsageDrafts>[1];
export const audioRole = 'audio';

const audioUsage = (media: TourAudio, target: string, sortOrder: number): ContentMediaUsage => ({
  uiId: `${target}-audio-${media.id ?? sortOrder}`,
  persistentUrl: media.sourceUrl.url,
  altText: '',
  caption: media.captionText ?? '',
  credit: media.copyright ?? '',
  role: audioRole,
  sortOrder,
  referenceStatus: 'synced',
  additionalData: { contentType: 'audio', initialUrl: media.sourceUrl.url },
});

export const initialAudio = (tour?: EditableTour): AudioUsages =>
  tour
    ? {
        [tourAudioTarget]: (tour.mediaContents ?? []).map((entry, index) =>
          audioUsage(entry, tourAudioTarget, index)
        ),
        ...Object.fromEntries(
          tour.tourStops.map((stop) => [
            stop.id,
            (stop.mediaContents ?? []).map((entry, index) => audioUsage(entry, stop.id, index)),
          ])
        ),
      }
    : {};

export const serializeTourAudio = (
  audio: AudioUsages,
  targets: readonly string[],
  resolutions: DraftResolutions
): TourAudioByTarget =>
  Object.fromEntries(
    targets.map((target) => {
      const usages = audio[target] ?? [];
      return [
        target,
        (resolutions.length ? resolveContentMediaUsageDrafts(usages, resolutions) : usages).map(
          (usage): TourAudio => ({
            contentType: 'audio',
            captionText: usage.caption.trim(),
            copyright: usage.credit.trim(),
            sourceUrl: { url: usage.persistentUrl.trim() },
          })
        ),
      ];
    })
  );
