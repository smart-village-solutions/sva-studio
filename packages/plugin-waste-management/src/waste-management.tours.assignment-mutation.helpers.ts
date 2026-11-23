import type { WasteToursState } from './use-waste-tours-state.js';
import {
  WasteManagementApiError,
  createWasteManagementLocationTourLinksBulk,
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
  getWasteManagementMasterDataOverview,
} from './waste-management.api.js';
import { submitWasteLocationTourLinksBulkInChunks } from './waste-management.location-tour-links-bulk-client.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type AssignmentMutationContext = {
  readonly state: WasteToursState;
  readonly pt: (key: string) => string;
};

const writeAssignments = async (
  tourId: string,
  currentLinkCount: number,
  createIds: readonly string[],
  deletes: readonly { id: string }[],
  assertWriteAccess: () => void
) => {
  if (currentLinkCount === 0 && createIds.length === 1) {
    await createWasteManagementLocationTourLink({
      id: crypto.randomUUID(),
      locationId: createIds[0]!,
      tourId,
    });
  } else if (createIds.length > 0) {
    await submitWasteLocationTourLinksBulkInChunks(
      wasteMasterDataInputMappers.toCreateLocationTourLinksBulkInput({ tourId }, createIds),
      (input) => {
        assertWriteAccess();
        return createWasteManagementLocationTourLinksBulk(input);
      }
    );
  }

  assertWriteAccess();
  const results = await Promise.allSettled(
    deletes.map((link) => deleteWasteManagementLocationTourLink(link.id))
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
};

export const createToursAssignmentSubmitHandler =
  ({ state, pt }: AssignmentMutationContext) =>
  async (
    tourId: string,
    changes: ReadonlyMap<string, boolean>,
    canContinue: () => boolean
  ): Promise<boolean> => {
    if (!canContinue() || !state.masterDataOverview) return false;
    const assertWriteAccess = () => {
      if (!canContinue()) throw new WasteManagementApiError('forbidden');
    };
    const reloadAssignments = async () => {
      assertWriteAccess();
      const overview = await getWasteManagementMasterDataOverview({
        scope: 'locations',
        fresh: true,
      });
      assertWriteAccess();
      state.setMasterDataOverview(overview);
      return overview.locationTourLinks.filter((link) => link.tourId === tourId);
    };

    state.setSaving(true);
    state.setMessage(null);
    try {
      const currentLinks = await reloadAssignments();
      const assignedLocations = new Set(currentLinks.map((link) => link.locationId));
      const createIds = [...changes]
        .filter(([id, selected]) => selected && !assignedLocations.has(id))
        .map(([id]) => id);
      const deletes = currentLinks.filter((link) => changes.get(link.locationId) === false);
      if (createIds.length === 0 && deletes.length === 0) return true;

      const writeError = await writeAssignments(
        tourId, currentLinks.length, createIds, deletes, assertWriteAccess
      ).catch((error: unknown) => error);
      const persistedLinks = await reloadAssignments();
      const persistedIds = new Set(persistedLinks.map((link) => link.locationId));
      if ([...changes].some(([id, selected]) => persistedIds.has(id) !== selected)) {
        throw writeError ?? new Error('assignment_readback_mismatch');
      }
      state.setMessage({
        kind: 'success',
        text: pt(
          currentLinks.length === 0
            ? 'tours.assignments.messages.createSuccess'
            : 'tours.assignments.messages.updateSuccess'
        ),
      });
      return true;
    } catch (error) {
      state.setMessage({
        kind: 'error',
        text: pt(
          resolveApiErrorCode(error) === 'forbidden'
            ? 'tours.assignments.messages.saveForbidden'
            : 'tours.assignments.messages.saveError'
        ),
      });
      return false;
    } finally {
      state.setSaving(false);
    }
  };
