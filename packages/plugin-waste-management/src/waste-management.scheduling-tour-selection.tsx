import type { WasteTourRecord } from '@sva/core';
import { Checkbox } from '@sva/studio-ui-react';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteSchedulingTourSelection = ({
  tours,
  selectedTourIds,
  pt,
  onChange,
}: {
  readonly tours: readonly WasteTourRecord[];
  readonly selectedTourIds: readonly string[];
  readonly pt: Translate;
  readonly onChange: (tourIds: readonly string[]) => void;
}) => (
  <div className="space-y-2 rounded-md border border-border/70 p-3">
    {tours.length ? (
      tours.map((tour) => {
        const checked = selectedTourIds.includes(tour.id);
        return (
          <label key={tour.id} className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={checked}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...selectedTourIds, tour.id]
                    : selectedTourIds.filter((value) => value !== tour.id)
                )
              }
            />
            <span>{tour.name}</span>
          </label>
        );
      })
    ) : (
      <p className="text-sm text-muted-foreground">{pt('scheduling.global.fields.noToursAvailable')}</p>
    )}
  </div>
);
