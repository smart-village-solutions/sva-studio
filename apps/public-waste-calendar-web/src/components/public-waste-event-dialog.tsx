import React from 'react';

import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';

export function PublicWasteEventDialog(props: Readonly<{
  entry: PublicWasteCalendarEntry | null;
  onClose: () => void;
}>) {
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!props.entry) {
      return;
    }

    closeButtonRef.current?.focus();
  }, [props.entry]);

  if (!props.entry) {
    return null;
  }

  const dialogTitleId = `pickup-dialog-title-${props.entry.id}`;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
          }
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
