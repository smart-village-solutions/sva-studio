import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';

export function PublicWasteEventDialog(props: Readonly<{
  entry: PublicWasteCalendarEntry | null;
  onClose: () => void;
}>) {
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
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <p className="dialog-eyebrow">Abholtermin</p>
            <h3 id={dialogTitleId} className="dialog-title">
              {props.entry.fractionLabel}
            </h3>
          </div>
          <button type="button" className="dialog-close" onClick={props.onClose}>
            Schließen
          </button>
        </div>
        <p className="body-copy">{props.entry.date}</p>
        <p className="body-copy">{props.entry.note ?? 'Für diesen Termin liegt kein zusätzlicher Hinweis vor.'}</p>
      </div>
    </div>
  );
}
