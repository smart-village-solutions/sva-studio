import type { WasteFractionRecord } from '@sva/core';
import { Checkbox } from '@sva/studio-ui-react';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteToursFractionSelection = ({
  fractions,
  selectedFractionIds,
  pt,
  onChange,
}: {
  readonly fractions: readonly WasteFractionRecord[];
  readonly selectedFractionIds: readonly string[];
  readonly pt: Translate;
  readonly onChange: (wasteFractionIds: readonly string[]) => void;
}) => (
  <div className="space-y-2 rounded-md border border-border/70 p-3">
    {fractions.length ? (
      fractions.map((fraction) => {
        const checked = selectedFractionIds.includes(fraction.id);
        return (
          <label key={fraction.id} className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={checked}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...selectedFractionIds, fraction.id]
                    : selectedFractionIds.filter((value) => value !== fraction.id)
                )
              }
            />
            <span>{fraction.name}</span>
          </label>
        );
      })
    ) : (
      <p className="text-sm text-muted-foreground">{pt('tours.fields.noFractionsAvailable')}</p>
    )}
  </div>
);
