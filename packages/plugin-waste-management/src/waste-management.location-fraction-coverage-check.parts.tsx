import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteRegionRecord,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, cn } from '@sva/studio-ui-react';
import { IconRoute } from '@tabler/icons-react';

import type { WasteLocationFractionCoverageIssue } from './waste-management.location-fraction-coverage.js';
import type { WasteManagementSearchParams } from './search-params.js';
import {
  CoverageIssueItem,
  CoverageLocalities,
} from './waste-management.location-fraction-coverage-check.items.js';

export type CoverageResult = Readonly<{
  issues: readonly WasteLocationFractionCoverageIssue[];
  checkedLocationCount: number;
  includeDrafts: boolean;
}>;

const CoverageIssueSection = ({
  id,
  title,
  issues,
  locationsById,
  search,
  onEdit,
  getLocationLabel,
}: Readonly<{
  id: string;
  title: string;
  issues: readonly WasteLocationFractionCoverageIssue[];
  locationsById: ReadonlyMap<string, WasteCollectionLocationRecord>;
  search?: WasteManagementSearchParams;
  onEdit: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>) =>
  issues.length > 0 ? (
    <section aria-labelledby={id}>
      <h4 id={id} className="mb-2 font-medium text-foreground">
        {title}
      </h4>
      <ul className="space-y-2">
        {issues.map((issue) => {
          const location = locationsById.get(issue.locationId);
          return location ? (
            <CoverageIssueItem
              key={issue.locationId}
              issue={issue}
              location={location}
              search={search}
              onEdit={onEdit}
              getLocationLabel={getLocationLabel}
            />
          ) : null;
        })}
      </ul>
    </section>
  ) : null;

const CoverageSummary = ({
  result,
  missingCount,
  incompleteCount,
  onAssign,
}: {
  result: CoverageResult;
  missingCount: number;
  incompleteCount: number;
  onAssign: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const hasCheckedLocations = result.checkedLocationCount > 0;
  return result.issues.length === 0 ? (
    <p
      aria-live="polite"
      className={cn(
        'rounded-md border p-3 text-sm text-foreground',
        hasCheckedLocations ? 'border-success/30 bg-success/5' : 'border-border-subtle bg-card'
      )}
    >
      {hasCheckedLocations
        ? pt('masterData.locationsWorkspace.coverage.complete', {
            value: result.checkedLocationCount,
          })
        : pt('masterData.locationsWorkspace.coverage.noActiveLocations')}
    </p>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
      <p className="text-sm text-foreground" aria-live="polite">
        {pt('masterData.locationsWorkspace.coverage.summary', {
          checked: result.checkedLocationCount,
          missing: missingCount,
          incomplete: incompleteCount,
        })}
      </p>
      <Button type="button" variant="secondary" onClick={onAssign}>
        <IconRoute aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.coverage.selectAndAssign', {
          value: result.issues.length,
        })}
      </Button>
    </div>
  );
};

export const CoverageResults = ({
  result,
  locationsById,
  cities = [],
  regions = [],
  search,
  onAssign,
  onEdit,
  getLocationLabel,
}: Readonly<{
  result: CoverageResult;
  locationsById: ReadonlyMap<string, WasteCollectionLocationRecord>;
  cities?: readonly WasteCityRecord[];
  regions?: readonly WasteRegionRecord[];
  search?: WasteManagementSearchParams;
  onAssign: () => void;
  onEdit: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const missing = result.issues.filter((issue) => issue.kind === 'missing');
  const incomplete = result.issues.filter((issue) => issue.kind === 'incomplete');
  const cityIds = new Set(cities.map((city) => city.id));
  const ungroupedMissing = missing.filter((issue) => {
    const location = locationsById.get(issue.locationId);
    return location && !cityIds.has(location.cityId);
  });
  return (
    <div className="mt-4 space-y-4">
      <CoverageSummary
        result={result}
        missingCount={missing.length}
        incompleteCount={incomplete.length}
        onAssign={onAssign}
      />
      {cities.length > 0 ? (
        <CoverageLocalities
          cities={cities}
          regions={regions}
          locationsById={locationsById}
          missing={missing}
          search={search}
          onEdit={onEdit}
          getLocationLabel={getLocationLabel}
        />
      ) : null}
      <CoverageIssueSection
        id="waste-location-coverage-missing"
        title={pt('masterData.locationsWorkspace.coverage.missing')}
        issues={ungroupedMissing}
        locationsById={locationsById}
        search={search}
        onEdit={onEdit}
        getLocationLabel={getLocationLabel}
      />
      <CoverageIssueSection
        id="waste-location-coverage-incomplete"
        title={pt('masterData.locationsWorkspace.coverage.incomplete')}
        issues={incomplete}
        locationsById={locationsById}
        search={search}
        onEdit={onEdit}
        getLocationLabel={getLocationLabel}
      />
    </div>
  );
};
