import { WasteMasterDataPagedLocationsTable } from './waste-management.master-data-locations-workspace.paged.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsWorkspace = (props: WasteMasterDataLocationsWorkspaceProps) => {
  return <WasteMasterDataPagedLocationsTable {...props} />;
};
