import type { SvaMainserverEventInput, SvaMainserverEventItem } from '../../types.js';
import { toSvaMainserverError } from './shared.js';

/**
 * Keeps event source data that has no Studio editor field. The Mainserver deletes and recreates
 * every relation on an update, so an omitted `location` or `repeatDuration` would be deleted.
 */

const withoutId = <T extends { readonly id?: string }>(value: T | undefined) => {
  if (!value) return undefined;
  const { id: _id, ...input } = value;
  return Object.keys(input).length > 0 ? input : undefined;
};

// A degraded read cannot be sent back faithfully, so the update is refused instead of
// deleting the relation.
const preserveRelation = <T>(
  fieldGroup: string,
  current: T | undefined,
  submitted: T | undefined,
  degradedFields: ReadonlySet<string>
): T | undefined => {
  if (submitted !== undefined) return submitted;
  if (degradedFields.has(fieldGroup)) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'event_source_snapshot_incomplete',
      statusCode: 502,
    });
  }
  return current;
};

// Media payloads follow their image by source URL and are dropped when the image is replaced.
// Payloads are never taken from the client.
const reattachMediaPayloads = (
  current: SvaMainserverEventItem,
  submitted: SvaMainserverEventInput['mediaContents'],
  degradedFields: ReadonlySet<string>
): SvaMainserverEventInput['mediaContents'] => {
  if (!submitted || degradedFields.has('mediaContents')) {
    return submitted;
  }
  const unmatched = current.mediaContents.filter((media) => media.payload !== undefined);
  return submitted.map((media) => {
    const index = unmatched.findIndex((entry) => entry.sourceUrl?.url === media.sourceUrl?.url);
    if (!media.sourceUrl?.url || index < 0) return media;
    const [match] = unmatched.splice(index, 1);
    return { ...media, payload: match?.payload };
  });
};

export const preserveEventSourceData = (
  current: SvaMainserverEventItem,
  submitted: SvaMainserverEventInput,
  degradedFields: ReadonlySet<string>
): Pick<SvaMainserverEventInput, 'location' | 'repeatDuration' | 'mediaContents'> => ({
  location: preserveRelation(
    'location',
    withoutId(current.location),
    submitted.location,
    degradedFields
  ),
  repeatDuration: preserveRelation(
    'repeatDuration',
    withoutId(current.repeatDuration),
    submitted.repeatDuration,
    degradedFields
  ),
  mediaContents: reattachMediaPayloads(current, submitted.mediaContents, degradedFields),
});
