import type React from 'react';
import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';
import { formatDateOnlyGerman } from '../lib/public-waste-date-utils.js';

export const renderPickupDot = (entry: PublicWasteCalendarEntry) => (
  <span
    className="pickup-dot"
    aria-hidden="true"
    style={entry.fractionColor ? { backgroundColor: entry.fractionColor } : undefined}
  />
);

export const renderPickupEntryButton = (
  entry: PublicWasteCalendarEntry,
  props: Readonly<{
    className: string;
    onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
    children: React.ReactNode;
  }>
) => (
  <button
    key={entry.id}
    type="button"
    className={props.className}
    aria-label={`Termin ${entry.fractionLabel} am ${formatDateOnlyGerman(entry.date)}`}
    onClick={() => props.onActivateEntry(entry)}
  >
    {props.children}
  </button>
);
