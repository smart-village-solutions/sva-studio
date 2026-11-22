import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
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
import {
  formatTourDateRange,
  formatTourRecurrence,
} from './waste-management.tours.presentation.js';
import { WasteToursRowFractionCell } from './waste-management.tours.table-row.parts.js';

const createFractionNameMap = (fractions: readonly WasteFractionRecord[]) =>
  new Map(fractions.map((fraction) => [fraction.id, fraction.name] as const));

const assignmentKey = 'masterData.collectionLocations.assignmentEditor';
type Draft = ReadonlyMap<string, boolean>;
type WriteReceipt = Readonly<{ id: string; exists: boolean }>;
type AssignmentAttempt = Readonly<{
  draft: Draft;
  receipts: readonly WriteReceipt[];
  forbidden: boolean;
}>;

const getLinkedTourIds = (links: readonly WasteLocationTourLinkRecord[]) =>
  new Set(links.map((link) => link.tourId));

const getUnconfirmedChanges = (draft: Draft, linkedTourIds: ReadonlySet<string>): Draft => {
  const pending = new Map(
    [...draft].filter(([tourId, selected]) => selected !== linkedTourIds.has(tourId))
  );
  return pending.size === draft.size ? draft : pending;
};

const applyAssignmentWrites = async (
  locationId: string,
  links: readonly WasteLocationTourLinkRecord[],
  draft: Draft,
  creationIds: Map<string, string>
): Promise<AssignmentAttempt> => {
  const results = await Promise.allSettled([
    ...[...draft]
      .filter(([, selected]) => selected)
      .map(async ([tourId]) => {
        const id = creationIds.get(tourId) ?? crypto.randomUUID();
        creationIds.set(tourId, id);
        const link = await createWasteManagementLocationTourLink({ id, locationId, tourId });
        return { id: link.id, exists: true };
      }),
    ...links
      .filter((link) => draft.get(link.tourId) === false)
      .map(async ({ id }) => {
        await deleteWasteManagementLocationTourLink(id);
        return { id, exists: false };
      }),
  ]);
  return {
    draft,
    receipts: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    forbidden: results.some(
      (result) => result.status === 'rejected' && resolveApiErrorCode(result.reason) === 'forbidden'
    ),
  };
};

type LocationAssignmentsProps = {
  readonly locationId: string;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
  readonly disabled?: boolean;
  readonly onReload: (locationId: string) => Promise<readonly WasteLocationTourLinkRecord[] | null>;
};

export const LocationAssignmentsSection = (props: LocationAssignmentsProps) => (
  <LocationAssignmentsEditor key={props.locationId} {...props} />
);

const LocationAssignmentsEditor = ({
  locationId,
  tours,
  fractions,
  links,
  disabled = false,
  onReload,
}: LocationAssignmentsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [draft, setDraft] = useState<Draft>(() => new Map());
  const [awaitingReadback, setAwaitingReadback] = useState<AssignmentAttempt | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const pendingRequest = useRef(false);
  const creationIds = useRef(new Map<string, string>());
  const linkedTourIds = useMemo(() => getLinkedTourIds(links), [links]);

  useEffect(() => {
    setDraft((current) => getUnconfirmedChanges(current, linkedTourIds));
  }, [linkedTourIds]);

  const sortedTours = useMemo(
    () =>
      [...tours].sort((left, right) =>
        left.name.localeCompare(right.name, 'de', { sensitivity: 'base' })
      ),
    [tours]
  );
  const fractionNamesById = useMemo(() => createFractionNameMap(fractions), [fractions]);
  const pendingChanges = getUnconfirmedChanges(draft, linkedTourIds);
  const isSelected = (tourId: string) => pendingChanges.get(tourId) ?? linkedTourIds.has(tourId);
  const allVisibleSelected =
    sortedTours.length > 0 && sortedTours.every(({ id }) => isSelected(id));
  const someVisibleSelected = sortedTours.some(({ id }) => isSelected(id));
  const selectionDisabled = disabled || saving || awaitingReadback !== null;
  const actionDisabled = disabled || saving || (!awaitingReadback && pendingChanges.size === 0);

  const toggleTours = (tourIds: readonly string[], checked: boolean) => {
    setMessage(null);
    setDraft((current) => {
      const next = new Map(current);
      for (const id of tourIds) {
        if (checked === linkedTourIds.has(id)) next.delete(id);
        else next.set(id, checked);
      }
      return next;
    });
  };

  const verifyAssignmentWrites = async (attempt: AssignmentAttempt) => {
    const refreshed = await onReload(locationId).catch(() => null);
    const observedIds = new Set(refreshed?.map((link) => link.id));
    if (!refreshed || attempt.receipts.some(({ id, exists }) => observedIds.has(id) !== exists)) {
      setAwaitingReadback(attempt);
      setMessage({ kind: 'warning', text: pt(`${assignmentKey}.messages.readBackUnconfirmed`) });
      return;
    }

    setAwaitingReadback(null);
    const confirmedTourIds = getLinkedTourIds(refreshed);
    for (const id of confirmedTourIds) creationIds.current.delete(id);
    const remaining = getUnconfirmedChanges(attempt.draft, confirmedTourIds);
    setDraft(remaining);
    if (remaining.size === 0) {
      setMessage({ kind: 'success', text: pt(`${assignmentKey}.messages.saveSuccess`) });
    } else if (remaining.size < attempt.draft.size) {
      setMessage({
        kind: 'warning',
        text: pt(`${assignmentKey}.messages.savePartial`, { value: String(remaining.size) }),
      });
    } else {
      setMessage({
        kind: 'error',
        text: pt(`${assignmentKey}.messages.${attempt.forbidden ? 'saveForbidden' : 'saveError'}`),
      });
    }
  };

  const handleSave = async () => {
    if (actionDisabled || pendingRequest.current) return;
    pendingRequest.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const attempt =
        awaitingReadback ??
        (await applyAssignmentWrites(locationId, links, pendingChanges, creationIds.current));
      await verifyAssignmentWrites(attempt);
    } finally {
      pendingRequest.current = false;
      setSaving(false);
    }
  };

  const actionLabel = saving
    ? awaitingReadback
      ? 'reloading'
      : 'saving'
    : awaitingReadback
      ? 'reload'
      : 'save';

  return (
    <section className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 sm:p-6">
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
              value: String(linkedTourIds.size),
            })}
          </p>
        </div>
        <Button type="button" disabled={actionDisabled} onClick={() => void handleSave()}>
          {pt(`${assignmentKey}.actions.${actionLabel}`)}
        </Button>
      </div>

      <StatusNotice message={message} />

      {sortedTours.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {pt('masterData.collectionLocations.assignmentEditor.empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-background/70">
          <div className="overflow-x-auto">
            <table
              className="min-w-full border-collapse"
              aria-label={pt('masterData.collectionLocations.assignmentEditor.title')}
            >
              <thead className="bg-surface-inset text-left text-[13px] text-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="w-11 px-3 py-3">
                    <Checkbox
                      aria-label={pt('tours.table.selectAll')}
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected && !allVisibleSelected}
                      disabled={selectionDisabled}
                      onChange={(event) =>
                        toggleTours(
                          sortedTours.map((tour) => tour.id),
                          event.currentTarget.checked
                        )
                      }
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
                  const periodId =
                    tour.firstDate || tour.endDate
                      ? `waste-location-tour-period-${tour.id}`
                      : undefined;
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
                          aria-describedby={periodId}
                          checked={isSelected(tour.id)}
                          disabled={selectionDisabled}
                          onChange={(event) => toggleTours([tour.id], event.currentTarget.checked)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">{tour.name}</p>
                        {periodId ? (
                          <p id={periodId} className="text-xs text-muted-foreground">
                            {formatTourDateRange(tour)}
                          </p>
                        ) : null}
                        {pendingChanges.has(tour.id) ? (
                          <p className="text-xs text-muted-foreground">
                            {pt(
                              `${assignmentKey}.meta.${isSelected(tour.id) ? 'additionPending' : 'removalPending'}`
                            )}
                          </p>
                        ) : null}
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
