import { startTransition, type FormEvent } from 'react';

import {
  createWasteManagementLocationTourLink,
  updateWasteManagementLocationTourLink,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { toCreateLocationTourLinkInput, toUpdateLocationTourLinkInput } from './waste-management.tours.shared.js';
import type { WasteToursState } from './waste-management.tours.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToursAssignmentSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitAssignments: async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.assignmentsDialogMode === 'create') {
        await createWasteManagementLocationTourLink(toCreateLocationTourLinkInput(state.linkForm));
      } else {
        await updateWasteManagementLocationTourLink(
          state.linkForm.id,
          toUpdateLocationTourLinkInput(state.linkForm)
        );
      }
      await loadOverview(true);
      startTransition(() => {
        state.setAssignmentsDialogOpen(false);
        state.setMessage({
          kind: 'success',
          text:
            state.assignmentsDialogMode === 'create'
              ? pt('tours.assignments.messages.createSuccess')
              : pt('tours.assignments.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.assignments.messages.saveForbidden')
            : pt('tours.assignments.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
