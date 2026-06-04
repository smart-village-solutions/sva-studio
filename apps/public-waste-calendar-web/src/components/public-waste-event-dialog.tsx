import React from 'react';

import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';

type PublicWasteEventDialogProps = Readonly<{
  entry: PublicWasteCalendarEntry | null;
  onClose: () => void;
}>;

const findDialogFocusableElements = (dialog: HTMLElement): readonly HTMLElement[] =>
  Array.from(
    dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

const trapDialogFocus = (event: React.KeyboardEvent, dialog: HTMLElement): void => {
  const focusableElements = findDialogFocusableElements(dialog);
  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement?.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement?.focus();
  }
};

const resolveEventHints = (entry: PublicWasteCalendarEntry): readonly string[] => {
  const hints = [entry.tourDescription?.trim(), entry.note?.trim()].filter(
    (value): value is string => Boolean(value)
  );
  return hints.length > 0 ? hints : ['Für diesen Termin liegt kein zusätzlicher Hinweis vor.'];
};

const handleDialogKeyDown = (
  event: React.KeyboardEvent,
  dialog: HTMLDivElement | null,
  onClose: () => void
): void => {
  if (event.key === 'Escape') {
    event.stopPropagation();
    onClose();
    return;
  }

  if (event.key !== 'Tab' || !dialog) {
    return;
  }

  trapDialogFocus(event, dialog);
};

export function PublicWasteEventDialog(props: PublicWasteEventDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!props.entry) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [props.entry]);

  if (!props.entry) {
    return null;
  }

  const dialogTitleId = `pickup-dialog-title-${props.entry.id}`;
  const hints = resolveEventHints(props.entry);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <div
        ref={dialogRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onKeyDown={(event) => handleDialogKeyDown(event, dialogRef.current, props.onClose)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <p className="dialog-eyebrow">Abholtermin</p>
            <h3 id={dialogTitleId} className="dialog-title">
              {props.entry.fractionLabel}
            </h3>
            {props.entry.tourName ? <p className="dialog-subtitle">{props.entry.tourName}</p> : null}
          </div>
          <button ref={closeButtonRef} type="button" className="dialog-close" onClick={props.onClose}>
            Schließen
          </button>
        </div>
        <div className="dialog-section">
          <p className="dialog-section-label">Datum</p>
          <p className="body-copy">{props.entry.date}</p>
        </div>
        <div className="dialog-section">
          <p className="dialog-section-label">Hinweis</p>
          {hints.map((hint, index) => (
            <p key={`${index}:${hint}`} className="body-copy">
              {hint}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
