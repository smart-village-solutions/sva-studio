import type { WasteToursState } from './use-waste-tours-state.js';
import {
  WasteManagementApiError,
  createWasteManagementLocationTourLinksBulk,
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
} from './waste-management.api.js';
import { submitWasteLocationTourLinksBulkInChunks } from './waste-management.location-tour-links-bulk-client.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type AssignmentMutationContext = {
  readonly state: WasteToursState;
  readonly pt: (key: string) => string;
  readonly loadOverview: (active?: boolean) => Promise<void>;
};

export const createToursAssignmentSubmitHandler =
  ({ state, pt, loadOverview }: AssignmentMutationContext) =>
  async (
    tourId: string,
    changes: ReadonlyMap<string, boolean>,
    canContinue: () => boolean
  ): Promise<boolean> => {
    if (!canContinue() || !state.masterDataOverview) return false;
    const assertWriteAccess = () => {
      if (!canContinue()) throw new WasteManagementApiError('forbidden');
    };
    const currentLinks = state.masterDataOverview.locationTourLinks.filter(
      (link) => link.tourId === tourId
    );
    const assignedLocations = new Set(currentLinks.map((link) => link.locationId));
    const createIds = [...changes]
      .filter(([id, selected]) => selected && !assignedLocations.has(id))
      .map(([id]) => id);
    const deletes = currentLinks.filter((link) => changes.get(link.locationId) === false);
    if (createIds.length === 0 && deletes.length === 0) return true;

    state.setSaving(true);
    state.setMessage(null);
    try {
      if (currentLinks.length === 0 && createIds.length === 1) {
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
      await Promise.all(deletes.map((link) => deleteWasteManagementLocationTourLink(link.id)));
      assertWriteAccess();
      await loadOverview(true);
      assertWriteAccess();
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
