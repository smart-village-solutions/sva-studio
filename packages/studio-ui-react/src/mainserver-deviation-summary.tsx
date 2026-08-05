import React from 'react';

import { Alert, AlertDescription, AlertTitle } from './alert.js';

export type MainserverDeviationSummaryItem = Readonly<{
  fieldGroup: string;
}>;

export type MainserverDeviationSummaryProps = Readonly<{
  deviations: readonly MainserverDeviationSummaryItem[];
  title: string;
  fieldLabel: (fieldGroup: string) => string;
}>;

export function MainserverDeviationSummary({
  deviations,
  title,
  fieldLabel,
}: MainserverDeviationSummaryProps) {
  const fieldGroups = [...new Set(deviations.map((deviation) => deviation.fieldGroup))];
  if (fieldGroups.length === 0) return null;

  return (
    <Alert className="border-destructive/40 text-destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {fieldGroups.map((fieldGroup) => (
            <li key={fieldGroup}>{fieldLabel(fieldGroup)}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
