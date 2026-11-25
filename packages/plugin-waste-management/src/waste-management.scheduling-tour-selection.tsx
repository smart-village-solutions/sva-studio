import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { SearchableMultiSelect } from '@sva/studio-ui-react';
import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteSchedulingTourSelection = ({
  id,
  tours,
  selectedTourIds,
  pt,
  onChange,
}: {
  readonly id: string;
  readonly tours: readonly WasteTourRecord[];
  readonly selectedTourIds: readonly string[];
  readonly pt: Translate;
  readonly onChange: (tourIds: readonly string[]) => void;
}) => (
  <SearchableMultiSelect
    id={id}
    value={selectedTourIds}
    disabled={tours.length === 0 && selectedTourIds.length === 0}
    helpText={tours.length === 0 ? pt('scheduling.global.fields.noToursAvailable') : undefined}
    placeholder={pt('scheduling.global.fields.chooseTours')}
    searchLabel={pt('scheduling.global.fields.searchTours')}
    emptyText={pt('scheduling.global.fields.noMatchingTours')}
    unavailableText={pt('scheduling.global.fields.unavailableTour')}
    removeLabel={(label) => pt('scheduling.global.fields.removeTour', { value: label })}
    options={tours.map((tour) => ({ value: tour.id, label: formatTourSelectionLabel(pt, tour) }))}
    onValueChange={onChange}
  />
);
