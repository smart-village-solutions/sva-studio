import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { Checkbox } from '@sva/studio-ui-react';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteToursFractionSelection = ({
  fractions,
  selectedFractionIds,
  disabled = false,
  pt,
  onChange,
}: {
  readonly fractions: readonly WasteFractionRecord[];
  readonly selectedFractionIds: readonly string[];
  readonly disabled?: boolean;
  readonly pt: Translate;
  readonly onChange: (wasteFractionIds: readonly string[]) => void;
}) => (
  <div className="space-y-1">
    {fractions.length ? (
      fractions.map((fraction) => {
        const checked = selectedFractionIds.includes(fraction.id);
        return (
          <label
            key={fraction.id}
            className={[
              'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
              checked ? 'bg-primary/5' : 'hover:bg-accent/30',
              disabled ? 'cursor-not-allowed opacity-70' : '',
            ].join(' ')}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...selectedFractionIds, fraction.id]
                    : selectedFractionIds.filter((value) => value !== fraction.id)
                )
              }
            />
            <div
              aria-label={pt('masterData.fractions.table.colorSwatch', { value: fraction.color })}
              className="inline-block h-6 w-6 shrink-0 rounded-sm border border-border/70"
              style={{ backgroundColor: fraction.color }}
            />
            <div className="min-w-0 flex-1">
              <span className="truncate font-medium text-foreground">
                {fraction.containerSize ? `${fraction.name} (${fraction.containerSize})` : fraction.name}
              </span>
            </div>
          </label>
        );
      })
    ) : (
      <p className="text-sm text-muted-foreground">{pt('tours.fields.noFractionsAvailable')}</p>
    )}
  </div>
);
