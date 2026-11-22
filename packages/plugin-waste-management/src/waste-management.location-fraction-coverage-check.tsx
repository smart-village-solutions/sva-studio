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
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
import {
  checkLocationFractionCoverage,
  needsCoverageScheduling,
} from './waste-management.location-fraction-coverage.js';
import {
  getWasteManagementSchedulingOverview,
  type WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteLocationCoverageDataStatus } from './use-waste-master-data-state.js';

type CoverageCheckProps = Readonly<{
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

const useResetResult = (
  props: CoverageCheckProps,
  criteria: readonly [
    fractionId: string,
    startDate: string,
    endDate: string,
    includeDrafts: boolean,
  ],
  setResult: Dispatch<SetStateAction<CoverageResult | null>>,
  invalidateCheck: () => void,
  setChecking: Dispatch<SetStateAction<boolean>>
) => {
  const [fractionId, startDate, endDate, includeDrafts] = criteria;
  useEffect(() => {
    setResult(null);
    invalidateCheck();
    setChecking(false);
    return invalidateCheck;
  }, [
    endDate,
    fractionId,
    includeDrafts,
    invalidateCheck,
    props.fractions,
    props.cities,
    props.fractionsStatus,
    props.links,
    props.locations,
    props.regions,
    props.tours,
    props.toursStatus,
    setChecking,
    setResult,
    startDate,
  ]);
};

const useCoverageCheckForm = (props: CoverageCheckProps) => {
  const [selectedFractionId, setFractionId] = useState('');
  const fractionId = props.fractions.some((fraction) => fraction.id === selectedFractionId)
    ? selectedFractionId
    : '';
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [checking, setChecking] = useState(false);
  const requestIdRef = useRef(0);
  useEffect(() => {
    if ((props.fractionsStatus ?? 'ready') === 'ready' && selectedFractionId && !fractionId) {
      setFractionId('');
    }
  }, [fractionId, props.fractionsStatus, selectedFractionId]);
  const invalidateCheck = useCallback(() => {
    requestIdRef.current += 1;
  }, []);
  useResetResult(
    props,
    [fractionId, startDate, endDate, includeDrafts],
    setResult,
    invalidateCheck,
    setChecking
  );
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
  const runCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = ++requestIdRef.current;
    const nextError = getCoverageErrorKey(fractionId, startDate, endDate);
    setErrorKey(nextError);
    setResult(null);
    if (nextError) return;
    const input = {
      locations: props.locations,
      tours: props.tours,
      links: props.links,
      fractionId,
      startDate,
      endDate,
      includeDrafts,
    };
    let scheduling: WasteManagementSchedulingOverview | undefined;
    if (needsCoverageScheduling(input)) {
      const access = readSessionAccessSnapshot();
      setChecking(true);
      try {
        scheduling = await getWasteManagementSchedulingOverview({ fresh: true });
        if (
          !Array.isArray(scheduling.tourDateShifts) ||
          !Array.isArray(scheduling.globalDateShifts) ||
          !Array.isArray(scheduling.holidayRules)
        ) {
          throw new Error('incomplete_coverage_schedule');
        }
      } catch {
        if (requestId === requestIdRef.current && readSessionAccessSnapshot() === access) {
          setErrorKey('masterData.locationsWorkspace.coverage.schedulingLoadError');
        }
        return;
      } finally {
        if (requestId === requestIdRef.current) setChecking(false);
      }
      if (requestId !== requestIdRef.current || readSessionAccessSnapshot() !== access) return;
    }
    setResult({
      issues: checkLocationFractionCoverage({ ...input, scheduling }),
      checkedLocationCount: props.locations.filter((location) => location.active).length,
      includeDrafts,
    });
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
    checking,
    result,
    changeYear,
    runCheck,
  };
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
    () => instanceId === 'bb-prignitz'
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
        hasFractions={fractions.length > 0}
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
