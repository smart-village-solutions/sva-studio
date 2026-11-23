import { readSessionAccessSnapshot } from '@sva/plugin-sdk';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';

import type { CoverageCheckProps } from './waste-management.location-fraction-coverage-check.js';
import type { CoverageResult } from './waste-management.location-fraction-coverage-check.parts.js';
import {
  checkLocationFractionCoverage,
  needsCoverageScheduling,
} from './waste-management.location-fraction-coverage.js';
import {
  getWasteManagementSchedulingOverview,
  type WasteManagementSchedulingOverview,
} from './waste-management.api.js';

const getCoverageErrorKey = (fractionId: string, startDate: string, endDate: string) =>
  !fractionId || !startDate || !endDate
    ? 'masterData.locationsWorkspace.coverage.required'
    : endDate < startDate
      ? 'masterData.locationsWorkspace.coverage.invalidDateRange'
      : null;

const readCoverageScheduling = async ({
  isCurrent,
  setChecking,
  setErrorKey,
}: {
  isCurrent: () => boolean;
  setChecking: (checking: boolean) => void;
  setErrorKey: (error: string) => void;
}): Promise<{ scheduling: WasteManagementSchedulingOverview } | null> => {
  const access = readSessionAccessSnapshot();
  const canApply = () => isCurrent() && readSessionAccessSnapshot() === access;
  setChecking(true);
  try {
    const scheduling = await getWasteManagementSchedulingOverview({ fresh: true });
    if (!hasCoverageSchedule(scheduling)) throw new Error('incomplete_coverage_schedule');
    return canApply() ? { scheduling } : null;
  } catch {
    if (canApply()) setErrorKey('masterData.locationsWorkspace.coverage.schedulingLoadError');
    return null;
  } finally {
    if (isCurrent()) setChecking(false);
  }
};

const hasCoverageSchedule = (schedule: WasteManagementSchedulingOverview) =>
  Array.isArray(schedule.tourDateShifts) &&
  Array.isArray(schedule.globalDateShifts) &&
  Array.isArray(schedule.holidayRules);

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

const useCoverageDates = () => {
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
  const changeStartDate = (value: string) => {
    setYear('');
    setStartDate(value);
  };
  const changeEndDate = (value: string) => {
    setYear('');
    setEndDate(value);
  };
  return { year, startDate, endDate, changeStartDate, changeEndDate, changeYear };
};

export const useCoverageCheckForm = (props: CoverageCheckProps) => {
  const [selectedFractionId, setFractionId] = useState('');
  const fractionId = props.fractions.some((fraction) => fraction.id === selectedFractionId)
    ? selectedFractionId
    : '';
  const { year, startDate, endDate, changeStartDate, changeEndDate, changeYear } =
    useCoverageDates();
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
    const schedule = needsCoverageScheduling(input)
      ? await readCoverageScheduling({
          isCurrent: () => requestId === requestIdRef.current,
          setChecking,
          setErrorKey,
        })
      : { scheduling: undefined };
    if (!schedule || requestId !== requestIdRef.current) return;
    setResult({
      issues: checkLocationFractionCoverage({ ...input, scheduling: schedule.scheduling }),
      checkedLocationCount: props.locations.filter((location) => location.active).length,
      includeDrafts,
    });
  };
  return {
    fractionId,
    setFractionId,
    year,
    startDate,
    changeStartDate,
    endDate,
    changeEndDate,
    includeDrafts,
    setIncludeDrafts,
    errorKey,
    checking,
    result,
    changeYear,
    runCheck,
  };
};
