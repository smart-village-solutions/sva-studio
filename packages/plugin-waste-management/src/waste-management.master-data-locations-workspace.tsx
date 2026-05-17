import { WasteMasterDataLocationsHierarchySection, WasteMasterDataLocationsOverviewSection } from './waste-management.master-data-locations-workspace.parts.js';
import { WasteMasterDataPagedLocationsTable } from './waste-management.master-data-locations-workspace.paged.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsWorkspace = (props: WasteMasterDataLocationsWorkspaceProps) => {
  return (
    <div className="space-y-4">
      <WasteMasterDataLocationsOverviewSection {...props} />
      <WasteMasterDataPagedLocationsTable {...props} />
      <WasteMasterDataLocationsHierarchySection {...props} />
    </div>
  );
};
