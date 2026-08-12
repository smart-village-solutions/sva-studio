import type { WasteCollectionLocationRecord, WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';
import { IconChecklist, IconEdit, IconRoute } from '@tabler/icons-react';
import type { FormEvent } from 'react';

import type { WasteLocationFractionCoverageIssue } from './waste-management.location-fraction-coverage.js';

export type CoverageResult = Readonly<{
  issues: readonly WasteLocationFractionCoverageIssue[];
  checkedLocationCount: number;
}>;

export const CoverageCheckForm = ({
  fractions,
  fractionId,
  startDate,
  endDate,
  onFractionChange,
  onStartDateChange,
  onEndDateChange,
  onSubmit,
}: Readonly<{
  fractions: readonly WasteFractionRecord[];
  fractionId: string;
  startDate: string;
  endDate: string;
  onFractionChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <form
      className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end"
      onSubmit={onSubmit}
      noValidate
    >
      <StudioField
        id="waste-location-coverage-fraction"
        label={pt('masterData.locationsWorkspace.coverage.fraction')}
      >
        <Select
          id="waste-location-coverage-fraction"
          value={fractionId}
          onChange={(event) => onFractionChange(event.target.value)}
        >
          <option value="">{pt('masterData.locationsWorkspace.coverage.fractionUnset')}</option>
          {fractions.map((fraction) => (
            <option key={fraction.id} value={fraction.id}>
              {fraction.name}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField
        id="waste-location-coverage-start"
        label={pt('masterData.locationsWorkspace.coverage.startDate')}
      >
        <Input
          id="waste-location-coverage-start"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </StudioField>
      <StudioField
        id="waste-location-coverage-end"
        label={pt('masterData.locationsWorkspace.coverage.endDate')}
      >
        <Input
          id="waste-location-coverage-end"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </StudioField>
      <Button type="submit">
        <IconChecklist aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.coverage.check')}
      </Button>
    </form>
  );
};

const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
};

const CoverageIssueItem = ({
  issue,
  location,
  onEdit,
  getLocationLabel,
}: Readonly<{
  issue: WasteLocationFractionCoverageIssue;
  location: WasteCollectionLocationRecord;
  onEdit: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
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
      <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(location)}>
        <IconEdit aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.coverage.edit')}
      </Button>
    </li>
  );
};

const CoverageIssueSection = ({
  id,
  title,
  issues,
  locationsById,
  onEdit,
  getLocationLabel,
}: Readonly<{
  id: string;
  title: string;
  issues: readonly WasteLocationFractionCoverageIssue[];
  locationsById: ReadonlyMap<string, WasteCollectionLocationRecord>;
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
              onEdit={onEdit}
              getLocationLabel={getLocationLabel}
            />
          ) : null;
        })}
      </ul>
    </section>
  ) : null;

export const CoverageResults = ({
  result,
  locationsById,
  onAssign,
  onEdit,
  getLocationLabel,
}: Readonly<{
  result: CoverageResult;
  locationsById: ReadonlyMap<string, WasteCollectionLocationRecord>;
  onAssign: () => void;
  onEdit: (location: WasteCollectionLocationRecord) => void;
  getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const missing = result.issues.filter((issue) => issue.kind === 'missing');
  const incomplete = result.issues.filter((issue) => issue.kind === 'incomplete');
  if (result.issues.length === 0) {
    return (
      <p
        className="mt-4 rounded-md border border-success/30 bg-success/5 p-3 text-sm text-foreground"
        aria-live="polite"
      >
        {pt('masterData.locationsWorkspace.coverage.complete', {
          value: result.checkedLocationCount,
        })}
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
        <p className="text-sm text-foreground">
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
      <CoverageIssueSection
        id="waste-location-coverage-missing"
        title={pt('masterData.locationsWorkspace.coverage.missing')}
        issues={missing}
        locationsById={locationsById}
        onEdit={onEdit}
        getLocationLabel={getLocationLabel}
      />
      <CoverageIssueSection
        id="waste-location-coverage-incomplete"
        title={pt('masterData.locationsWorkspace.coverage.incomplete')}
        issues={incomplete}
        locationsById={locationsById}
        onEdit={onEdit}
        getLocationLabel={getLocationLabel}
      />
    </div>
  );
};
