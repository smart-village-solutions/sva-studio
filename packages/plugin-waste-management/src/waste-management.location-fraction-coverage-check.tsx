import type {
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconChecklist } from '@tabler/icons-react';
import { useMemo, useState, type FormEvent } from 'react';

import {
  CoverageCheckForm,
  CoverageFractionsAvailability,
  CoverageToursAvailability,
} from './waste-management.location-fraction-coverage-check.form.js';
import {
  CoverageResults,
  type CoverageResult,
} from './waste-management.location-fraction-coverage-check.parts.js';
import { checkLocationFractionCoverage } from './waste-management.location-fraction-coverage.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteLocationCoverageDataStatus } from './use-waste-master-data-state.js';

type CoverageCheckProps = Readonly<{
  search?: WasteManagementSearchParams;
  locations: readonly WasteCollectionLocationRecord[];
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

const getCoverageErrorKey = (fractionId: string, startDate: string, endDate: string) =>
  !fractionId || !startDate || !endDate
    ? 'masterData.locationsWorkspace.coverage.required'
    : endDate < startDate
      ? 'masterData.locationsWorkspace.coverage.invalidDateRange'
      : null;

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

export const WasteLocationFractionCoverageCheck = (props: CoverageCheckProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [fractionId, setFractionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const fractionsStatus = props.fractionsStatus ?? 'ready';
  const toursStatus = props.toursStatus ?? 'ready';
  const coverageDataUnavailable =
    fractionsStatus !== 'ready' || toursStatus !== 'ready' || props.fractions.length === 0;
  const locationsById = useMemo(
    () => new Map(props.locations.map((location) => [location.id, location] as const)),
    [props.locations]
  );
  const runCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextError = getCoverageErrorKey(fractionId, startDate, endDate);
    setErrorKey(nextError);
    setResult(
      nextError
        ? null
        : {
            issues: checkLocationFractionCoverage({
              locations: props.locations,
              tours: props.tours,
              links: props.links,
              fractionId,
              startDate,
              endDate,
            }),
            checkedLocationCount: props.locations.filter((location) => location.active).length,
          }
    );
  };
  const assignIssues = () => {
    props.onReplaceLocationSelection((result?.issues ?? []).map((issue) => issue.locationId));
    props.onOpenBulkAssignments();
  };
  return (
    <section
      className="border-b border-border/70 bg-muted/10 px-4 py-4"
      aria-labelledby="waste-location-coverage-title"
    >
      <CoverageCheckHeader />
      <CoverageCheckForm
        fractions={props.fractions}
        disabled={coverageDataUnavailable}
        fractionId={fractionId}
        startDate={startDate}
        endDate={endDate}
        onFractionChange={setFractionId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onSubmit={runCheck}
      />
      <CoverageFractionsAvailability
        status={fractionsStatus}
        hasFractions={props.fractions.length > 0}
      />
      <CoverageToursAvailability status={toursStatus} />
      {errorKey ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {pt(errorKey)}
        </p>
      ) : null}
      {result ? (
        <CoverageResults
          result={result}
          search={props.search}
          locationsById={locationsById}
          onAssign={assignIssues}
          onEdit={props.onOpenEditLocation}
          getLocationLabel={props.getLocationLabel}
        />
      ) : null}
    </section>
  );
};
