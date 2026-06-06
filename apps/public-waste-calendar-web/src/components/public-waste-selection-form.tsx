import React from 'react';
import { IconChevronRight, IconSearch } from '@tabler/icons-react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';

export type PublicWasteSelectionPathItem = {
  readonly step: string;
  readonly label: string;
};

const MAX_VISIBLE_SUGGESTIONS = 8;

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
  const shouldUseSearch = true;
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) {
      return [];
    }
    return sortedOptions.filter((option) => normalizeSearchValue(option.label).includes(normalizedQuery));
  }, [searchQuery, sortedOptions]);
  const visibleOptions = React.useMemo(
    () => filteredOptions.slice(0, MAX_VISIBLE_SUGGESTIONS),
    [filteredOptions]
  );

  React.useEffect(() => {
    setSearchQuery('');
  }, [props.nextStepLabel, props.options]);

  return (
    <section className="selection-panel" aria-label="Standortauswahl">
      <div className="selection-intro">
        <h2 className="section-title">Standort wählen</h2>
        <p className="body-copy">Stellen Sie Ihren Abholort Schritt für Schritt zusammen.</p>
      </div>
      {props.selectionPath.length === 0 ? null : (
        <div className="selection-path" aria-label="Auswahlpfad">
          {props.selectionPath.map((entry, index) => (
            <button
              key={`${entry.step}-${entry.label}`}
              type="button"
              className="selection-path-chip"
              aria-label={`${entry.step} ändern`}
              onClick={() => props.onEditStep(index)}
            >
              <span className="selection-path-chip-step">{entry.step}</span>
              <strong className="selection-path-chip-label">{entry.label}</strong>
              <span className="selection-path-chip-action">Ändern</span>
            </button>
          ))}
        </div>
      )}
      <div className="selection-step-card">
        <div className="selection-step-card-header">
          <span className="selection-step-kicker">Aktiver Schritt</span>
          <h3 className="selection-step-title">{`${props.nextStepLabel} wählen`}</h3>
          <p className="selection-step-copy">Wählen Sie jetzt einen Eintrag aus der Liste.</p>
        </div>
        <div className="selection-combobox">
          <div className="selection-search-panel">
            <label className="sr-only" htmlFor={`selection-search-${props.nextStepLabel}`}>
              {`${props.nextStepLabel} suchen`}
            </label>
            <div className="selection-search-shell">
              <IconSearch size={18} stroke={1.75} aria-hidden="true" />
              <input
                id={`selection-search-${props.nextStepLabel}`}
                className="selection-search-input"
                type="text"
                aria-label={`${props.nextStepLabel} suchen`}
                aria-autocomplete="list"
                autoComplete="off"
                placeholder={`${props.nextStepLabel} suchen`}
                value={searchQuery}
                autoFocus
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <p className="selection-search-meta">
              {searchQuery.trim().length === 0
                ? 'Geben Sie die ersten Zeichen ein, um Vorschläge zu erhalten.'
                : `${filteredOptions.length} Treffer`}
            </p>
          </div>
        </div>
        <div className="selection-results" aria-label={`${props.nextStepLabel}-Auswahl`}>
          {visibleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="selection-result"
              aria-label={option.label}
              onClick={() => props.onSelectOption(option.id)}
            >
              <span className="selection-result-label">{option.label}</span>
              <span className="selection-result-action">
                <span>Übernehmen</span>
                <IconChevronRight size={18} stroke={1.75} aria-hidden="true" />
              </span>
            </button>
          ))}
          {shouldUseSearch && filteredOptions.length === 0 && searchQuery.trim().length > 0 ? (
            <div className="selection-empty-state" role="status">
              Keine Treffer für diese Suche.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
