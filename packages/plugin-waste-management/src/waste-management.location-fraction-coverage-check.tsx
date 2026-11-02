import type {
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { ListChecks as IconChecklist } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';

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
        <IconChecklist strokeWidth={1} aria-hidden="true" className="h-5 w-5" />
        {pt('masterData.locationsWorkspace.coverage.title')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {pt('masterData.locationsWorkspace.coverage.description')}
      </p>
    </div>
  );
};

const useResetResult = (
  props: CoverageCheckProps,
  criteria: readonly [
    fractionId: string,
    startDate: string,
    endDate: string,
    includeDrafts: boolean,
  ],
  setResult: Dispatch<SetStateAction<CoverageResult | null>>
) => {
  const [fractionId, startDate, endDate, includeDrafts] = criteria;
  useEffect(() => {
    setResult(null);
  }, [
    endDate,
    fractionId,
    includeDrafts,
    props.fractions,
    props.fractionsStatus,
    props.links,
    props.locations,
    props.tours,
    props.toursStatus,
    setResult,
    startDate,
  ]);
};

const useCoverageCheckForm = (props: CoverageCheckProps) => {
  const [fractionId, setFractionId] = useState('');
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoverageResult | null>(null);
  useResetResult(props, [fractionId, startDate, endDate, includeDrafts], setResult);
  const changeYear = (value: string) => {
    setYear(value);
    if (/^(20\d{2}|2100)$/.test(value)) {
      setStartDate(`${value}-01-01`);
      setEndDate(`${value}-12-31`);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };
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
              includeDrafts,
            }),
            checkedLocationCount: props.locations.filter((location) => location.active).length,
            includeDrafts,
          }
    );
  };
  return {
    fractionId,
    setFractionId,
    year,
    setYear,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    includeDrafts,
    setIncludeDrafts,
    errorKey,
    result,
    changeYear,
    runCheck,
  };
};

export const WasteLocationFractionCoverageCheck = (props: CoverageCheckProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const form = useCoverageCheckForm(props);
  const fractionsStatus = props.fractionsStatus ?? 'ready';
  const toursStatus = props.toursStatus ?? 'ready';
  const coverageDataUnavailable =
    fractionsStatus !== 'ready' || toursStatus !== 'ready' || props.fractions.length === 0;
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
        fractions={props.fractions}
        disabled={coverageDataUnavailable}
        fractionId={form.fractionId}
        year={form.year}
        startDate={form.startDate}
        endDate={form.endDate}
        includeDrafts={form.includeDrafts}
        onFractionChange={form.setFractionId}
        onYearChange={form.changeYear}
        onStartDateChange={(value) => {
          form.setYear('');
          form.setStartDate(value);
        }}
        onEndDateChange={(value) => {
          form.setYear('');
          form.setEndDate(value);
        }}
        onIncludeDraftsChange={form.setIncludeDrafts}
        onSubmit={form.runCheck}
      />
      <CoverageFractionsAvailability
        status={fractionsStatus}
        hasFractions={props.fractions.length > 0}
      />
      <CoverageToursAvailability status={toursStatus} />
      {form.errorKey ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {pt(form.errorKey)}
        </p>
      ) : null}
      {form.result ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {pt('masterData.locationsWorkspace.coverage.assignmentNotice')}
          </p>
          {form.result.includeDrafts ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {pt('masterData.locationsWorkspace.coverage.planningNotice')}
            </p>
          ) : null}
          <CoverageResults
            result={form.result}
            search={props.search}
            locationsById={locationsById}
            onAssign={assignIssues}
            onEdit={props.onOpenEditLocation}
            getLocationLabel={props.getLocationLabel}
          />
        </>
      ) : null}
    </section>
  );
};
