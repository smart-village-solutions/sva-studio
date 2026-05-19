import React from 'react';

import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';

const findDialogFocusableElements = (dialog: HTMLElement): readonly HTMLElement[] =>
  Array.from(
    dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));

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

export function PublicWasteEventDialog(props: Readonly<{
  entry: PublicWasteCalendarEntry | null;
  onClose: () => void;
}>) {
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

  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <div
        ref={dialogRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
            return;
          }

          if (event.key !== 'Tab' || !dialogRef.current) {
            return;
          }

          trapDialogFocus(event, dialogRef.current);
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <p className="dialog-eyebrow">Abholtermin</p>
            <h3 id={dialogTitleId} className="dialog-title">
              {props.entry.fractionLabel}
            </h3>
          </div>
          <button ref={closeButtonRef} type="button" className="dialog-close" onClick={props.onClose}>
            Schließen
          </button>
        </div>
        <p className="body-copy">{props.entry.date}</p>
        <p className="body-copy">{props.entry.note ?? 'Für diesen Termin liegt kein zusätzlicher Hinweis vor.'}</p>
      </div>
    </div>
  );
}
