import { useEffect, useMemo, useState } from 'react';
import type {
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox } from '@sva/studio-ui-react';

import {
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
} from './waste-management.api.js';
import {
  StatusNotice,
  resolveApiErrorCode,
  type StatusMessage,
} from './waste-management.page.support.js';
import { formatTourRecurrence } from './waste-management.tours.presentation.js';
import { WasteToursRowFractionCell } from './waste-management.tours.table-row.parts.js';

const createFractionNameMap = (fractions: readonly WasteFractionRecord[]) =>
  new Map(fractions.map((fraction) => [fraction.id, fraction.name] as const));

export const LocationAssignmentsSection = ({
  locationId,
  tours,
  fractions,
  links,
  disabled = false,
  onReload,
}: {
  readonly locationId: string;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
  readonly disabled?: boolean;
  readonly onReload: () => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  useEffect(() => {
    setSelectedTourIds(Array.from(new Set(links.map((link) => link.tourId))));
  }, [links, locationId]);

  const sortedTours = useMemo(
    () =>
      [...tours].sort((left, right) =>
        left.name.localeCompare(right.name, 'de', { sensitivity: 'base' })
      ),
    [tours]
  );
  const selectedTourIdSet = useMemo(() => new Set(selectedTourIds), [selectedTourIds]);
  const linkedTourIdSet = useMemo(() => new Set(links.map((link) => link.tourId)), [links]);
  const fractionNamesById = useMemo(() => createFractionNameMap(fractions), [fractions]);
  const allVisibleSelected =
    sortedTours.length > 0 && sortedTours.every((tour) => selectedTourIdSet.has(tour.id));
  const someVisibleSelected = sortedTours.some((tour) => selectedTourIdSet.has(tour.id));

  const toggleSelectedTour = (tourId: string, checked: boolean) => {
    setSelectedTourIds((current) => {
      if (checked) {
        return current.includes(tourId) ? current : [...current, tourId];
      }

      return current.filter((currentTourId) => currentTourId !== tourId);
    });
  };

  const handleSave = async () => {
    const toursToCreate = selectedTourIds.filter((tourId) => !linkedTourIdSet.has(tourId));
    const linksToDelete = links.filter((link) => !selectedTourIdSet.has(link.tourId));

    if (toursToCreate.length === 0 && linksToDelete.length === 0) {
      setMessage({
        kind: 'success',
        text: pt('masterData.collectionLocations.assignmentEditor.messages.saveSuccess'),
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await Promise.all([
        ...toursToCreate.map((tourId) =>
          createWasteManagementLocationTourLink({
            id: crypto.randomUUID(),
            locationId,
            tourId,
          })
        ),
        ...linksToDelete.map((link) => deleteWasteManagementLocationTourLink(link.id)),
      ]);

      await onReload();
      setMessage({
        kind: 'success',
        text: pt('masterData.collectionLocations.assignmentEditor.messages.saveSuccess'),
      });
    } catch (error) {
      const code = resolveApiErrorCode(error);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.collectionLocations.assignmentEditor.messages.saveForbidden')
            : pt('masterData.collectionLocations.assignmentEditor.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {pt('masterData.collectionLocations.assignmentEditor.title')}
          </p>
          <p className="text-sm text-muted-foreground">
            {pt('masterData.collectionLocations.assignmentEditor.description')}
          </p>
          <p className="text-xs text-muted-foreground">
            {pt('masterData.collectionLocations.assignmentEditor.meta.selectedCount', {
              value: String(selectedTourIds.length),
            })}
          </p>
        </div>
        <Button
          type="button"
          disabled={disabled || saving || sortedTours.length === 0}
          onClick={() => void handleSave()}
        >
          {saving
            ? pt('masterData.collectionLocations.assignmentEditor.actions.saving')
            : pt('masterData.collectionLocations.assignmentEditor.actions.save')}
        </Button>
      </div>

      <StatusNotice message={message} />

      {sortedTours.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {pt('masterData.collectionLocations.assignmentEditor.empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/70">
          <div className="overflow-x-auto">
            <table
              className="min-w-full border-collapse"
              aria-label={pt('masterData.collectionLocations.assignmentEditor.title')}
            >
              <thead className="bg-muted/20 text-left text-[13px] text-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="w-11 px-3 py-3">
                    <Checkbox
                      aria-label={pt('tours.table.selectAll')}
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected && !allVisibleSelected}
                      disabled={disabled || saving}
                      onChange={(event) => {
                        setSelectedTourIds(
                          event.currentTarget.checked ? sortedTours.map((tour) => tour.id) : []
                        );
                      }}
                    />
                  </th>
                  <th scope="col" className="w-[220px] px-3 py-3 font-semibold">
                    {pt('tours.table.name')}
                  </th>
                  <th scope="col" className="w-[220px] px-3 py-3">
                    {pt('tours.table.fractions')}
                  </th>
                  <th scope="col" className="w-[180px] px-3 py-3 font-semibold">
                    {pt('tours.table.recurrence')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTours.map((tour) => {
                  const fractionNames = (tour.wasteFractionIds ?? [])
                    .map((fractionId: string) => fractionNamesById.get(fractionId))
                    .filter((value: string | undefined): value is string => Boolean(value));

                  return (
                    <tr
                      key={tour.id}
                      className="border-b border-border/50 align-top last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          aria-label={pt('tours.table.selectRow', { value: tour.name })}
                          checked={selectedTourIdSet.has(tour.id)}
                          disabled={disabled || saving}
                          onChange={(event) =>
                            toggleSelectedTour(tour.id, event.currentTarget.checked)
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">{tour.name}</p>
                      </td>
                      <WasteToursRowFractionCell tourId={tour.id} fractionNames={fractionNames} />
                      <td className="px-3 py-3 text-sm text-foreground">
                        {formatTourRecurrence(
                          pt,
                          tour.recurrence,
                          tour.customRecurrenceName,
                          tour.customRecurrenceIntervalDays
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
