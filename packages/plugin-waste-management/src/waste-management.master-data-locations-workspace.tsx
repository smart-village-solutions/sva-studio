import { WasteLocationFractionCoverageCheck } from './waste-management.location-fraction-coverage-check.js';
import { WasteMasterDataPagedLocationsTable } from './waste-management.master-data-locations-workspace.paged.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsWorkspace = (props: WasteMasterDataLocationsWorkspaceProps) => {
  return (
    <div className="space-y-4">
      <WasteLocationFractionCoverageCheck
        search={props.search}
        locations={props.auditCollectionLocations ?? props.collectionLocations}
        fractions={props.fractions ?? []}
        tours={props.availableTours}
        links={props.locationTourLinks}
        onReplaceLocationSelection={props.onReplaceLocationSelection}
        onOpenBulkAssignments={props.onOpenBulkAssignments}
        onOpenEditLocation={props.onOpenEditLocation}
        getLocationLabel={props.getLocationLabel}
      />
      <WasteMasterDataPagedLocationsTable {...props} />
    </div>
  );
};
