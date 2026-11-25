import type { WasteFractionRecord } from '@sva/waste-management-contracts';
import { SearchableMultiSelect } from '@sva/studio-ui-react';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteToursFractionSelection = ({
  id,
  fractions,
  selectedFractionIds,
  disabled = false,
  pt,
  onChange,
}: {
  readonly id: string;
  readonly fractions: readonly WasteFractionRecord[];
  readonly selectedFractionIds: readonly string[];
  readonly disabled?: boolean;
  readonly pt: Translate;
  readonly onChange: (wasteFractionIds: readonly string[]) => void;
}) => (
  <SearchableMultiSelect
    id={id}
    value={selectedFractionIds}
    disabled={disabled || (fractions.length === 0 && selectedFractionIds.length === 0)}
    helpText={fractions.length === 0 ? pt('tours.fields.noFractionsAvailable') : undefined}
    placeholder={pt('tours.fields.chooseFractions')}
    searchLabel={pt('tours.fields.searchFractions')}
    emptyText={pt('tours.fields.noMatchingFractions')}
    unavailableText={pt('tours.fields.unavailableFraction')}
    removeLabel={(label) => pt('tours.fields.removeFraction', { value: label })}
    options={fractions.map((fraction) => ({
      value: fraction.id,
      label: fraction.containerSize
        ? `${fraction.name} (${fraction.containerSize})`
        : fraction.name,
      leadingVisual: (
        <span
          role="img"
          aria-label={pt('masterData.fractions.table.colorSwatch', { value: fraction.color })}
          className="inline-block h-6 w-6 shrink-0 rounded-sm border border-border/70"
          style={{ backgroundColor: fraction.color }}
        />
      ),
    }))}
    onValueChange={onChange}
  />
);
