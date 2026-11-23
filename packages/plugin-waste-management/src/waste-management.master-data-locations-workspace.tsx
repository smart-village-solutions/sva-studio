import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { useState } from 'react';
import { WasteLocationFractionCoverageCheck } from './waste-management.location-fraction-coverage-check.js';
import { WasteMasterDataPagedLocationsTable } from './waste-management.master-data-locations-workspace.paged.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsWorkspace = (
  props: WasteMasterDataLocationsWorkspaceProps
) => {
  const pt = usePluginTranslation('wasteManagement');
  const [coverageOpen, setCoverageOpen] = useState(false);
  return (
    <WasteMasterDataPagedLocationsTable
      {...props}
      tools={
        <Button
          type="button"
          variant="secondary"
          aria-expanded={coverageOpen}
          aria-controls="waste-location-coverage"
          onClick={() => setCoverageOpen(!coverageOpen)}
        >
          {pt('filters.coverage')}
        </Button>
      }
      toolContent={
        <div id="waste-location-coverage" hidden={!coverageOpen}>
          <WasteLocationFractionCoverageCheck
            search={props.search}
            locations={props.auditCollectionLocations ?? props.collectionLocations}
            cities={props.auditCities ?? props.cities}
            regions={props.auditRegions ?? props.regions}
            fractions={props.fractions ?? []}
            fractionsStatus={props.fractionsStatus}
            toursStatus={props.toursStatus}
            tours={props.availableTours}
            links={props.locationTourLinks}
            onReplaceLocationSelection={props.onReplaceLocationSelection}
            onOpenBulkAssignments={props.onOpenBulkAssignments}
            onOpenEditLocation={props.onOpenEditLocation}
            getLocationLabel={props.getLocationLabel}
          />
        </div>
      }
    />
  );
};
