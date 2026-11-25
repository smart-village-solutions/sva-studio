import type { WasteTourAssignmentRecord } from '@sva/waste-management-contracts';
import type { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { WasteManagementSearchParams } from './search-params.js';
import {
  toWasteCollectionLocationEditSearch,
  toWasteTourEditSearch,
} from './waste-management.cross-link.navigation.js';
import { formatSchedulingDisplayDate } from './waste-management.scheduling-table-meta.js';

type Translate = ReturnType<typeof usePluginTranslation>;

const AssignmentActions = ({
  entry,
  pt,
  onEdit,
  onDeleteRequest,
}: Readonly<{
  entry: WasteTourAssignmentRecord;
  pt: Translate;
  onEdit: (entry: WasteTourAssignmentRecord) => void;
  onDeleteRequest: (entry: WasteTourAssignmentRecord) => void;
}>) => (
  <div className="flex justify-end gap-1">
    <Button
      type="button"
      variant="tertiary"
      size="sm"
      className="h-8 w-8 px-0"
      aria-label={pt('scheduling.assignments.actions.edit')}
      tooltip={pt('scheduling.assignments.actions.edit')}
      onClick={() => onEdit(entry)}
    >
      <IconEdit aria-hidden="true" className="h-4 w-4" />
    </Button>
    <Button
      type="button"
      variant="tertiary"
      size="sm"
      className="h-8 w-8 px-0"
      aria-label={pt('scheduling.assignments.actions.delete')}
      tooltip={pt('scheduling.assignments.actions.delete')}
      onClick={() => onDeleteRequest(entry)}
    >
      <IconTrash aria-hidden="true" className="h-4 w-4" />
    </Button>
  </div>
);

export const AssignmentRow = ({
  entry,
  tourLabels,
  locationLabels,
  pt,
  search,
  canManage,
  onEdit,
  onDeleteRequest,
}: {
  readonly entry: WasteTourAssignmentRecord;
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly pt: Translate;
  readonly search?: WasteManagementSearchParams;
  readonly canManage: boolean;
  readonly onEdit: (entry: WasteTourAssignmentRecord) => void;
  readonly onDeleteRequest: (entry: WasteTourAssignmentRecord) => void;
}) => (
  <tr className="border-b border-border-subtle align-top text-[14px] last:border-b-0 hover:bg-surface-inset">
    <td className="px-3 py-3">
      <time dateTime={entry.pickupDate}>{formatSchedulingDisplayDate(entry.pickupDate)}</time>
    </td>
    <td className="px-3 py-3">
      {search ? (
        <Link
          to="/plugins/waste-management"
          search={toWasteTourEditSearch(search, entry.tourId)}
          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {tourLabels.get(entry.tourId) ?? entry.tourId}
        </Link>
      ) : (
        (tourLabels.get(entry.tourId) ?? entry.tourId)
      )}
    </td>
    <td className="px-3 py-3">
      <ul>
        {entry.locationIds.map((id) => (
          <li key={id}>
            {search ? (
              <Link
                to="/plugins/waste-management"
                search={toWasteCollectionLocationEditSearch(search, id)}
                className="text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {locationLabels.get(id) ?? id}
              </Link>
            ) : (
              (locationLabels.get(id) ?? id)
            )}
          </li>
        ))}
      </ul>
    </td>
    <td className="px-3 py-3">{entry.note ?? ''}</td>
    {canManage ? (
      <td className="px-3 py-3">
        <AssignmentActions
          entry={entry}
          pt={pt}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
        />
      </td>
    ) : null}
  </tr>
);
