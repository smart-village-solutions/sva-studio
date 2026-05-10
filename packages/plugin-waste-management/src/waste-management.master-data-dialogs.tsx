import type { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { WasteMasterDataEntityDialogs } from './waste-management.master-data.entity-dialogs.js';
import { WasteMasterDataLocationDialogs } from './waste-management.master-data.location-dialogs.js';

type Controller = ReturnType<typeof useWasteMasterDataController>;

export const WasteMasterDataDialogs = ({ controller }: { readonly controller: Controller }) => (
  <>
    <WasteMasterDataEntityDialogs controller={controller} />
    <WasteMasterDataLocationDialogs controller={controller} />
  </>
);
