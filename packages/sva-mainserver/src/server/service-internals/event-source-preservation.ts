import type { SvaMainserverEventInput, SvaMainserverEventItem } from '../../types.js';
import { toSvaMainserverError } from './shared.js';

/**
 * Keeps event source data that has no Studio editor field. The Mainserver deletes and recreates
 * every relation on an update, so an omitted relation is deleted.
 */

// Event relations the Mainserver replaces on every update with `forceCreate`.
const REPLACED_RELATIONS = [
  'dates',
  'categories',
  'addresses',
  'location',
  'contacts',
  'urls',
  'mediaContents',
  'organizer',
  'priceInformations',
  'accessibilityInformation',
  'repeatDuration',
] as const satisfies readonly (keyof SvaMainserverEventInput)[];

/**
 * A client omits a relation whose read was degraded unless the editor corrected it. Sending the
 * update without it would delete the stored relation, so the update is refused before any write.
 */
export const assertDegradedRelationsSubmitted = (
  submitted: SvaMainserverEventInput,
  degradedFields: ReadonlySet<string>
): void => {
  if (
    REPLACED_RELATIONS.some(
      (relation) => degradedFields.has(relation) && submitted[relation] === undefined
    )
  ) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'event_source_snapshot_incomplete',
      statusCode: 502,
    });
  }
};

const withoutId = <T extends { readonly id?: string }>(value: T | undefined) => {
  if (!value) return undefined;
  const { id: _id, ...input } = value;
  return Object.keys(input).length > 0 ? input : undefined;
};

// Media payloads follow their stored entry by Mainserver id, so removing, reordering or
// duplicating URLs cannot move a payload to another entry. Payloads are never taken from the
// client; the ids are references only and are removed before the mutation.
const reattachMediaPayloads = (
  current: SvaMainserverEventItem,
  submitted: SvaMainserverEventInput['mediaContents']
): SvaMainserverEventInput['mediaContents'] => {
  if (!submitted) return submitted;
  const payloads = new Map(
    current.mediaContents.flatMap((media) =>
      media.id && media.payload !== undefined ? [[media.id, media.payload] as const] : []
    )
  );
  return submitted.map((media) =>
    media.id && payloads.has(media.id) ? { ...media, payload: payloads.get(media.id) } : media
  );
};

export const preserveEventSourceData = (
  current: SvaMainserverEventItem,
  submitted: SvaMainserverEventInput
): Pick<SvaMainserverEventInput, 'location' | 'repeatDuration' | 'mediaContents'> => ({
  location: submitted.location ?? withoutId(current.location),
  repeatDuration: submitted.repeatDuration ?? withoutId(current.repeatDuration),
  mediaContents: reattachMediaPayloads(current, submitted.mediaContents),
});
