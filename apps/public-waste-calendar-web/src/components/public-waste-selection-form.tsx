import React from 'react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';

export type PublicWasteSelectionPathItem = {
  readonly step: string;
  readonly label: string;
};

const MAX_VISIBLE_LIST_OPTIONS = 6;

const normalizeSearchValue = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');

const sortOptions = (options: readonly PublicWasteSelectableEntry[]): readonly PublicWasteSelectableEntry[] =>
  [...options].sort((left, right) => left.label.localeCompare(right.label, 'de'));

export function PublicWasteSelectionForm(props: Readonly<{
  nextStepLabel: string;
  options: readonly PublicWasteSelectableEntry[];
  selectionPath: readonly PublicWasteSelectionPathItem[];
  onEditStep: (stepIndex: number) => void;
  onSelectOption: (optionId: string) => void;
}>) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const sortedOptions = React.useMemo(() => sortOptions(props.options), [props.options]);
  const shouldUseSearch = sortedOptions.length > MAX_VISIBLE_LIST_OPTIONS;
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) {
      return sortedOptions;
    }
    return sortedOptions.filter((option) => normalizeSearchValue(option.label).includes(normalizedQuery));
  }, [searchQuery, sortedOptions]);

  React.useEffect(() => {
    setSearchQuery('');
  }, [props.nextStepLabel, props.options]);

  return (
    <section className="selection-panel" aria-label="Standortauswahl">
      <h2 className="section-title">Standort wählen</h2>
      {props.selectionPath.length === 0 ? null : (
        <div className="selection-path" aria-label="Auswahlpfad">
          {props.selectionPath.map((entry, index) => (
            <div key={`${entry.step}-${entry.label}`} className="selection-path-item">
              <span className="selection-path-step">{entry.step}</span>
              <strong className="selection-path-label">{entry.label}</strong>
              <button
                type="button"
                className="selection-path-action"
                onClick={() => props.onEditStep(index)}
              >
                {`${entry.step} ändern`}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="body-copy">Nächster Schritt: {props.nextStepLabel}</p>
      {shouldUseSearch ? (
        <div className="selection-combobox">
          <div className="selection-search-panel">
            <label className="sr-only" htmlFor={`selection-search-${props.nextStepLabel}`}>
              {`${props.nextStepLabel} suchen`}
            </label>
            <input
              id={`selection-search-${props.nextStepLabel}`}
              className="selection-search-input"
              type="text"
              aria-label={`${props.nextStepLabel} suchen`}
              value={searchQuery}
              autoFocus
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="selection-grid">
              {filteredOptions.map((option) => (
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
          </div>
        </div>
      ) : (
        <div className="selection-grid">
          {sortedOptions.map((option) => (
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
      )}
    </section>
  );
}
