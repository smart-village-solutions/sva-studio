import type { FilteredPublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';

export function PublicWasteCalendarPanels(props: Readonly<{
  model: FilteredPublicWasteCalendarViewModel;
  pdfLinks: readonly string[];
  icalUrl: string;
  onToggleFraction: (fractionId: string) => void;
}>) {
  const currentYearPdf = props.pdfLinks[1];

  return (
    <section className="calendar-panel" aria-label="Kalenderansicht">
      <div className="calendar-actions">
        {props.pdfLinks.map((href, index) => {
          const year = new Date().getFullYear() + index - 1;
          return (
            <a key={href} href={href} className="action-link">
              {`PDF ${year}`}
            </a>
          );
        })}
        {!currentYearPdf ? null : <span className="sr-only">{currentYearPdf}</span>}
        <a href={props.icalUrl} className="action-link">
          iCal abonnieren
        </a>
      </div>
      <div className="filter-list" aria-label="Fraktionsfilter">
        {props.model.fractionOptions.map((fraction) => {
          const checked = props.model.activeFractionIds.includes(fraction.id);
          return (
            <label key={fraction.id} className="filter-chip">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => props.onToggleFraction(fraction.id)}
              />
              <span>{fraction.label}</span>
            </label>
          );
        })}
      </div>
      <ul className="pickup-list">
        {props.model.listEntries.map((entry) => (
          <li key={entry.id} className="pickup-item">
            <strong>{entry.fractionLabel}</strong>
            <span>{entry.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
