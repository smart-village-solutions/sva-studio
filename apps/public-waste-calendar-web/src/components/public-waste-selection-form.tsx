import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';

export function PublicWasteSelectionForm(props: Readonly<{
  nextStepLabel: string;
  options: readonly PublicWasteSelectableEntry[];
  onSelectOption: (optionId: string) => void;
}>) {
  return (
    <section className="selection-panel" aria-label="Standortauswahl">
      <h2 className="section-title">Standort wählen</h2>
      <p className="body-copy">Nächster Schritt: {props.nextStepLabel}</p>
      <div className="selection-grid">
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="selection-option"
            onClick={() => props.onSelectOption(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
