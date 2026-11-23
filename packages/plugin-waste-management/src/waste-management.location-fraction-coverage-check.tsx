import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { IconChecklist } from '@tabler/icons-react';
import { useMemo, useSyncExternalStore } from 'react';

import {
  CoverageCheckForm,
  CoverageFractionsAvailability,
  CoverageToursAvailability,
} from './waste-management.location-fraction-coverage-check.form.js';
import { CoverageResults } from './waste-management.location-fraction-coverage-check.parts.js';
import { useCoverageCheckForm } from './use-waste-location-coverage-check.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteLocationCoverageDataStatus } from './use-waste-master-data-state.js';

export type CoverageCheckProps = Readonly<{
  search?: WasteManagementSearchParams;
  locations: readonly WasteCollectionLocationRecord[];
  cities?: readonly WasteCityRecord[];
  regions?: readonly WasteRegionRecord[];
  fractions: readonly WasteFractionRecord[];
  fractionsStatus?: WasteLocationCoverageDataStatus;
  toursStatus?: WasteLocationCoverageDataStatus;
  tours: readonly WasteTourRecord[];
  links: readonly WasteLocationTourLinkRecord[];
  onReplaceLocationSelection: (locationIds: readonly string[]) => void;
  onOpenBulkAssignments: () => void;
  onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>;

const CoverageCheckHeader = () => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-1">
      <h3
        id="waste-location-coverage-title"
        className="flex items-center gap-2 font-semibold text-foreground"
      >
        <IconChecklist aria-hidden="true" className="h-5 w-5" />
        {pt('masterData.locationsWorkspace.coverage.title')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {pt('masterData.locationsWorkspace.coverage.description')}
      </p>
    </div>
  );
};

const CoverageResultNotices = ({ includeDrafts }: { includeDrafts: boolean }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <p className="mt-3 text-sm text-muted-foreground">
        {pt('masterData.locationsWorkspace.coverage.assignmentNotice')}
      </p>
      {includeDrafts ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {pt('masterData.locationsWorkspace.coverage.planningNotice')}
        </p>
      ) : null}
    </>
  );
};

export const WasteLocationFractionCoverageCheck = (props: CoverageCheckProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const { instanceId } = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  // Prignitz uses this exact name for the occasional mobile hazardous-waste collection.
  const fractions = useMemo(
    () =>
      instanceId === 'bb-prignitz'
        ? props.fractions.filter((fraction) => fraction.name.trim() !== 'Schadstoffmobil')
        : props.fractions,
    [instanceId, props.fractions]
  );
  const form = useCoverageCheckForm({ ...props, fractions });
  const fractionsStatus = props.fractionsStatus ?? 'ready';
  const toursStatus = props.toursStatus ?? 'ready';
  const coverageDataUnavailable =
    fractionsStatus !== 'ready' || toursStatus !== 'ready' || fractions.length === 0;
  const locationsById = useMemo(
    () => new Map(props.locations.map((location) => [location.id, location] as const)),
    [props.locations]
  );
  const assignIssues = () => {
    props.onReplaceLocationSelection((form.result?.issues ?? []).map((issue) => issue.locationId));
    props.onOpenBulkAssignments();
  };
  return (
    <section
      className="border-b border-border/70 bg-surface-inset px-4 py-4"
      aria-labelledby="waste-location-coverage-title"
    >
      <CoverageCheckHeader />
      <CoverageCheckForm
        fractions={fractions}
        disabled={coverageDataUnavailable}
        checking={form.checking}
        fractionId={form.fractionId}
        year={form.year}
        startDate={form.startDate}
        endDate={form.endDate}
        includeDrafts={form.includeDrafts}
        onFractionChange={form.setFractionId}
        onYearChange={form.changeYear}
        onStartDateChange={form.changeStartDate}
        onEndDateChange={form.changeEndDate}
        onIncludeDraftsChange={form.setIncludeDrafts}
        onSubmit={form.runCheck}
      />
      <CoverageFractionsAvailability status={fractionsStatus} hasFractions={fractions.length > 0} />
      <CoverageToursAvailability status={toursStatus} />
      {form.errorKey ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {pt(form.errorKey)}
        </p>
      ) : null}
      {form.result ? (
        <>
          <CoverageResultNotices includeDrafts={form.result.includeDrafts} />
          <CoverageResults
            result={form.result}
            search={props.search}
            locationsById={locationsById}
            cities={props.cities}
            regions={props.regions}
            onAssign={assignIssues}
            onEdit={props.onOpenEditLocation}
            getLocationLabel={props.getLocationLabel}
          />
        </>
      ) : null}
    </section>
  );
};
