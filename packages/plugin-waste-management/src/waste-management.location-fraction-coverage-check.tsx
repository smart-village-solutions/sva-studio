import type {
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';
import { IconChecklist, IconEdit, IconRoute } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';

import {
  checkLocationFractionCoverage,
  type WasteLocationFractionCoverageIssue,
} from './waste-management.location-fraction-coverage.js';

type WasteLocationFractionCoverageCheckProps = Readonly<{
  locations: readonly WasteCollectionLocationRecord[];
  fractions: readonly WasteFractionRecord[];
  tours: readonly WasteTourRecord[];
  links: readonly WasteLocationTourLinkRecord[];
  onToggleLocation: (locationId: string, checked: boolean) => void;
  onOpenBulkAssignments: () => void;
  onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>;

type CoverageResult = Readonly<{
  issues: readonly WasteLocationFractionCoverageIssue[];
  checkedLocationCount: number;
}>;

const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
};

export const WasteLocationFractionCoverageCheck = ({
  locations,
  fractions,
  tours,
  links,
  onToggleLocation,
  onOpenBulkAssignments,
  onOpenEditLocation,
  getLocationLabel,
}: WasteLocationFractionCoverageCheckProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [fractionId, setFractionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const locationsById = new Map(locations.map((location) => [location.id, location] as const));

  const runCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fractionId || !startDate || !endDate) {
      setErrorKey('masterData.locationsWorkspace.coverage.required');
      setResult(null);
      return;
    }
    if (endDate < startDate) {
      setErrorKey('masterData.locationsWorkspace.coverage.invalidDateRange');
      setResult(null);
      return;
    }

    setErrorKey(null);
    setResult({
      issues: checkLocationFractionCoverage({
        locations,
        tours,
        links,
        fractionId,
        startDate,
        endDate,
      }),
      checkedLocationCount: locations.filter((location) => location.active).length,
    });
  };

  const missingIssues = result?.issues.filter((issue) => issue.kind === 'missing') ?? [];
  const incompleteIssues = result?.issues.filter((issue) => issue.kind === 'incomplete') ?? [];

  const renderIssue = (issue: WasteLocationFractionCoverageIssue) => {
    const location = locationsById.get(issue.locationId);
    if (!location) {
      return null;
    }

    return (
      <li key={issue.locationId} className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
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
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenEditLocation(location)}>
          <IconEdit aria-hidden="true" className="h-4 w-4" />
          {pt('masterData.locationsWorkspace.coverage.edit')}
        </Button>
      </li>
    );
  };

  return (
    <section className="border-b border-border/70 bg-muted/10 px-4 py-4" aria-labelledby="waste-location-coverage-title">
      <div className="space-y-1">
        <h3 id="waste-location-coverage-title" className="flex items-center gap-2 font-semibold text-foreground">
          <IconChecklist aria-hidden="true" className="h-5 w-5" />
          {pt('masterData.locationsWorkspace.coverage.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {pt('masterData.locationsWorkspace.coverage.description')}
        </p>
      </div>
      <form className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end" onSubmit={runCheck} noValidate>
        <StudioField id="waste-location-coverage-fraction" label={pt('masterData.locationsWorkspace.coverage.fraction')}>
          <Select
            id="waste-location-coverage-fraction"
            value={fractionId}
            onChange={(event) => setFractionId(event.target.value)}
          >
            <option value="">{pt('masterData.locationsWorkspace.coverage.fractionUnset')}</option>
            {fractions.map((fraction) => (
              <option key={fraction.id} value={fraction.id}>{fraction.name}</option>
            ))}
          </Select>
        </StudioField>
        <StudioField id="waste-location-coverage-start" label={pt('masterData.locationsWorkspace.coverage.startDate')}>
          <Input
            id="waste-location-coverage-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </StudioField>
        <StudioField id="waste-location-coverage-end" label={pt('masterData.locationsWorkspace.coverage.endDate')}>
          <Input
            id="waste-location-coverage-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </StudioField>
        <Button type="submit">
          <IconChecklist aria-hidden="true" className="h-4 w-4" />
          {pt('masterData.locationsWorkspace.coverage.check')}
        </Button>
      </form>
      {errorKey ? <p className="mt-3 text-sm text-destructive" role="alert">{pt(errorKey)}</p> : null}
      {result ? (
        <div className="mt-4 space-y-4" aria-live="polite">
          {result.issues.length === 0 ? (
            <p className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-foreground">
              {pt('masterData.locationsWorkspace.coverage.complete', {
                value: result.checkedLocationCount,
              })}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
                <p className="text-sm text-foreground">
                  {pt('masterData.locationsWorkspace.coverage.summary', {
                    checked: result.checkedLocationCount,
                    missing: missingIssues.length,
                    incomplete: incompleteIssues.length,
                  })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    for (const issue of result.issues) {
                      onToggleLocation(issue.locationId, true);
                    }
                    onOpenBulkAssignments();
                  }}
                >
                  <IconRoute aria-hidden="true" className="h-4 w-4" />
                  {pt('masterData.locationsWorkspace.coverage.selectAndAssign', {
                    value: result.issues.length,
                  })}
                </Button>
              </div>
              {missingIssues.length > 0 ? (
                <section aria-labelledby="waste-location-coverage-missing">
                  <h4 id="waste-location-coverage-missing" className="mb-2 font-medium text-foreground">
                    {pt('masterData.locationsWorkspace.coverage.missing')}
                  </h4>
                  <ul className="space-y-2">{missingIssues.map(renderIssue)}</ul>
                </section>
              ) : null}
              {incompleteIssues.length > 0 ? (
                <section aria-labelledby="waste-location-coverage-incomplete">
                  <h4 id="waste-location-coverage-incomplete" className="mb-2 font-medium text-foreground">
                    {pt('masterData.locationsWorkspace.coverage.incomplete')}
                  </h4>
                  <ul className="space-y-2">{incompleteIssues.map(renderIssue)}</ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};
