import type { WasteLocationTourLinkRecord } from '@sva/waste-management-contracts';
import {
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
} from './waste-management.api.js';
import { resolveApiErrorCode, type StatusMessage } from './waste-management.page.support.js';

export type Draft = ReadonlyMap<string, boolean>;
type WriteReceipt = Readonly<{ id: string; exists: boolean }>;
export type AssignmentAttempt = Readonly<{
  draft: Draft;
  receipts: readonly WriteReceipt[];
  forbidden: boolean;
}>;

export const getLinkedTourIds = (links: readonly WasteLocationTourLinkRecord[]) =>
  new Set(links.map((link) => link.tourId));

export const getUnconfirmedChanges = (draft: Draft, linkedTourIds: ReadonlySet<string>): Draft => {
  const pending = new Map(
    [...draft].filter(([tourId, selected]) => selected !== linkedTourIds.has(tourId))
  );
  return pending.size === draft.size ? draft : pending;
};

export const applyAssignmentWrites = async (
  locationId: string,
  links: readonly WasteLocationTourLinkRecord[],
  draft: Draft,
  creationIds: Map<string, string>
): Promise<AssignmentAttempt> => {
  const results = await Promise.allSettled([
    ...[...draft]
      .filter(([, selected]) => selected)
      .map(async ([tourId]) => {
        const id = creationIds.get(tourId) ?? crypto.randomUUID();
        creationIds.set(tourId, id);
        const link = await createWasteManagementLocationTourLink({ id, locationId, tourId });
        return { id: link.id, exists: true };
      }),
    ...links
      .filter((link) => draft.get(link.tourId) === false)
      .map(async ({ id }) => {
        await deleteWasteManagementLocationTourLink(id);
        return { id, exists: false };
      }),
  ]);
  return {
    draft,
    receipts: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    forbidden: results.some(
      (result) => result.status === 'rejected' && resolveApiErrorCode(result.reason) === 'forbidden'
    ),
  };
};

export const assignmentWriteStatus = (
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string,
  attempt: AssignmentAttempt,
  remaining: number
): StatusMessage => {
  const key = 'masterData.collectionLocations.assignmentEditor.messages';
  if (remaining === 0) {
    return { kind: 'success', text: pt(`${key}.saveSuccess`) };
  }
  if (remaining < attempt.draft.size) {
    return { kind: 'warning', text: pt(`${key}.savePartial`, { value: String(remaining) }) };
  }
  return {
    kind: 'error',
    text: pt(attempt.forbidden ? `${key}.saveForbidden` : `${key}.saveError`),
  };
};

export const readBackAssignments = async (
  onReload: (id: string) => Promise<readonly WasteLocationTourLinkRecord[] | null>,
  locationId: string,
  attempt: AssignmentAttempt
) => {
  const refreshed = await onReload(locationId).catch(() => null);
  const observedIds = new Set(refreshed?.map((link) => link.id));
  return refreshed && attempt.receipts.every(({ id, exists }) => observedIds.has(id) === exists)
    ? refreshed
    : null;
};
