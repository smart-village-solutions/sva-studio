import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteRegionRecord,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, cn } from '@sva/studio-ui-react';
import { IconEdit, IconRoute } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

import type { WasteLocationFractionCoverageIssue } from './waste-management.location-fraction-coverage.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { toWasteCollectionLocationEditSearch } from './waste-management.cross-link.navigation.js';
import { createCityOptionLabels } from './waste-management.address-option-labels.js';

export type CoverageResult = Readonly<{
  issues: readonly WasteLocationFractionCoverageIssue[];
  checkedLocationCount: number;
  includeDrafts: boolean;
}>;

const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
};

const CoverageIssueItem = ({
  issue,
  location,
  search,
  onEdit,
  getLocationLabel,
}: Readonly<{
  issue: WasteLocationFractionCoverageIssue;
  location: WasteCollectionLocationRecord;
  search?: WasteManagementSearchParams;
  onEdit: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-subtle bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{getLocationLabel(location)}</p>
        {issue.kind === 'incomplete' ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {issue.gaps.map((gap) => (
              <li key={`${gap.startDate}:${gap.endDate}`}>
                {pt('masterData.locationsWorkspace.coverage.gap', {
                  startDate: formatDate(gap.startDate),
                  endDate: formatDate(gap.endDate),
                })}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button
        asChild={Boolean(search)}
        variant="secondary"
        size="sm"
        {...(!search ? { onClick: () => onEdit(location) } : {})}
      >
        {search ? (
          <Link
            to="/plugins/waste-management"
            search={toWasteCollectionLocationEditSearch(search, location.id)}
          >
            <IconEdit aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.locationsWorkspace.coverage.edit')}
          </Link>
        ) : (
          <>
            <IconEdit aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.locationsWorkspace.coverage.edit')}
          </>
        )}
      </Button>
    </li>
  );
};

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

const CoverageLocalities = ({
  cities,
  regions,
  locationsById,
  missing,
  search,
  onEdit,
  getLocationLabel,
}: Readonly<{
  cities: readonly WasteCityRecord[];
  regions: readonly WasteRegionRecord[];
  locationsById: ReadonlyMap<string, WasteCollectionLocationRecord>;
  missing: readonly WasteLocationFractionCoverageIssue[];
  search?: WasteManagementSearchParams;
  onEdit: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const labels = createCityOptionLabels(
    cities,
    regions,
    pt('masterData.locationsWorkspace.table.regionUnavailable')
  );
  const missingById = new Map(missing.map((issue) => [issue.locationId, issue]));
  const localities = cities.map(({ id, name }) => ({
    id,
    label: labels.get(id) ?? name,
    activeCount: 0,
    missingLocations: [] as {
      location: WasteCollectionLocationRecord;
      issue: WasteLocationFractionCoverageIssue;
    }[],
  }));
  const byCity = new Map(localities.map((locality) => [locality.id, locality]));
  for (const location of locationsById.values()) {
    if (!location.active) continue;
    const locality = byCity.get(location.cityId);
    if (!locality) continue;
    locality.activeCount += 1;
    const issue = missingById.get(location.id);
    if (issue) locality.missingLocations.push({ location, issue });
  }
  localities.sort((left, right) => left.label.localeCompare(right.label, 'de'));

  return (
    <section aria-labelledby="waste-location-coverage-localities">
      <h4 id="waste-location-coverage-localities" className="mb-2 font-medium text-foreground">
        {pt('masterData.locationsWorkspace.coverage.localityTitle')}
      </h4>
      <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-card">
        {localities.map(({ id, label, activeCount, missingLocations }) => {
          const assignedCount = activeCount - missingLocations.length;
          const status =
            assignedCount === 0
              ? 'localityMissing'
              : assignedCount === activeCount
                ? 'localityComplete'
                : 'localityPartial';
          const row = (
            <span className="inline-flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium text-foreground">{label}</span>
              <span className="text-sm text-muted-foreground">
                {pt(`masterData.locationsWorkspace.coverage.${status}`, {
                  assigned: assignedCount,
                  total: activeCount,
                })}
              </span>
            </span>
          );
          return (
            <li key={id}>
              {missingLocations.length > 0 ? (
                <details>
                  <summary className="cursor-pointer rounded-md px-3 py-2">{row}</summary>
                  <ul className="space-y-2 px-3 pb-3">
                    {missingLocations.map(({ location, issue }) => (
                      <CoverageIssueItem
                        key={location.id}
                        issue={issue}
                        location={location}
                        search={search}
                        onEdit={onEdit}
                        getLocationLabel={getLocationLabel}
                      />
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="px-3 py-2">{row}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
  const hasCheckedLocations = result.checkedLocationCount > 0;
  const cityIds = new Set(cities.map((city) => city.id));
  const ungroupedMissing = missing.filter((issue) => {
    const location = locationsById.get(issue.locationId);
    return location && !cityIds.has(location.cityId);
  });
  return (
    <div className="mt-4 space-y-4">
      {result.issues.length === 0 ? (
        <p
          aria-live="polite"
          className={cn(
            'rounded-md border p-3 text-sm text-foreground',
            hasCheckedLocations ? 'border-success/30 bg-success/5' : 'border-border-subtle bg-card'
          )}
        >
          {hasCheckedLocations
            ? pt('masterData.locationsWorkspace.coverage.complete', { value: result.checkedLocationCount })
            : pt('masterData.locationsWorkspace.coverage.noActiveLocations')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
          <p className="text-sm text-foreground" aria-live="polite">
            {pt('masterData.locationsWorkspace.coverage.summary', {
              checked: result.checkedLocationCount,
              missing: missing.length,
              incomplete: incomplete.length,
            })}
          </p>
          <Button type="button" variant="secondary" onClick={onAssign}>
            <IconRoute aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.locationsWorkspace.coverage.selectAndAssign', {
              value: result.issues.length,
            })}
          </Button>
        </div>
      )}
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
