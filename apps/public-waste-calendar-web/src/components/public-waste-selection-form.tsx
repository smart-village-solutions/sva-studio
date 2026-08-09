import React from 'react';
import { IconChevronDown, IconChevronRight, IconSearch } from '@tabler/icons-react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';

export type PublicWasteSelectionPathItem = {
  readonly step: string;
  readonly label: string;
};

const normalizeSearchValue = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');

const sortOptions = (
  options: readonly PublicWasteSelectableEntry[]
): readonly PublicWasteSelectableEntry[] =>
  [...options].sort((left, right) => left.label.localeCompare(right.label, 'de'));

export function PublicWasteSelectionForm(
  props: Readonly<{
    nextStepLabel: string;
    options: readonly PublicWasteSelectableEntry[];
    selectionPath: readonly PublicWasteSelectionPathItem[];
    onEditStep: (stepIndex: number) => void;
    onSelectOption: (optionId: string) => void;
  }>
) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [canScrollDown, setCanScrollDown] = React.useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = React.useState(-1);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const comboboxId = React.useId();
  const resultsId = `${comboboxId}-results`;
  const statusId = `${comboboxId}-status`;
  const sortedOptions = React.useMemo(() => sortOptions(props.options), [props.options]);
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) {
      return sortedOptions;
    }
    return sortedOptions.filter((option) =>
      normalizeSearchValue(option.label).includes(normalizedQuery)
    );
  }, [searchQuery, sortedOptions]);

  React.useEffect(() => {
    setSearchQuery('');
    setActiveOptionIndex(-1);
  }, [props.nextStepLabel, props.options]);

  const activateOption = (index: number) => {
    const option = filteredOptions[index];
    if (!option) {
      return;
    }

    setActiveOptionIndex(index);
    document
      .getElementById(`${comboboxId}-option-${option.id}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activateOption(Math.min(activeOptionIndex + 1, filteredOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activateOption(activeOptionIndex <= 0 ? filteredOptions.length - 1 : activeOptionIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      activateOption(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      activateOption(filteredOptions.length - 1);
      return;
    }

    if (event.key === 'Enter' && activeOptionIndex >= 0) {
      event.preventDefault();
      const activeOption = filteredOptions[activeOptionIndex];
      if (activeOption) {
        props.onSelectOption(activeOption.id);
      }
      return;
    }

    if (event.key === 'Escape' && (searchQuery.length > 0 || activeOptionIndex >= 0)) {
      event.preventDefault();
      setSearchQuery('');
      setActiveOptionIndex(-1);
    }
  };

  const updateScrollHint = React.useCallback(() => {
    const results = resultsRef.current;
    setCanScrollDown(
      results !== null && results.scrollHeight - results.scrollTop - results.clientHeight > 1
    );
  }, []);

  React.useLayoutEffect(() => {
    updateScrollHint();
    const results = resultsRef.current;
    if (!results || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(results);
    return () => observer.disconnect();
  }, [filteredOptions, updateScrollHint]);

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
                role="combobox"
                aria-autocomplete="list"
                aria-controls={resultsId}
                aria-describedby={statusId}
                aria-expanded="true"
                aria-haspopup="listbox"
                aria-activedescendant={
                  activeOptionIndex >= 0 && filteredOptions[activeOptionIndex]
                    ? `${comboboxId}-option-${filteredOptions[activeOptionIndex].id}`
                    : undefined
                }
                autoComplete="off"
                placeholder={`${props.nextStepLabel} suchen`}
                value={searchQuery}
                autoFocus
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveOptionIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <p
              id={statusId}
              className="selection-search-meta"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {searchQuery.trim().length === 0
                ? `${filteredOptions.length} ${filteredOptions.length === 1 ? 'Eintrag' : 'Einträge'}`
                : `${filteredOptions.length} Treffer`}
            </p>
          </div>
        </div>
        <div className="selection-results-shell">
          <div
            id={resultsId}
            ref={resultsRef}
            className="selection-results"
            role="listbox"
            aria-label={`${props.nextStepLabel}-Auswahl`}
            onScroll={updateScrollHint}
          >
            {filteredOptions.map((option, index) => (
              <button
                key={option.id}
                id={`${comboboxId}-option-${option.id}`}
                type="button"
                className="selection-result"
                role="option"
                aria-label={option.label}
                aria-selected={activeOptionIndex === index}
                tabIndex={-1}
                onClick={() => props.onSelectOption(option.id)}
                onMouseMove={() => setActiveOptionIndex(index)}
              >
                <span className="selection-result-label">{option.label}</span>
                <span className="selection-result-action">
                  <span>Übernehmen</span>
                  <IconChevronRight size={18} stroke={1.75} aria-hidden="true" />
                </span>
              </button>
            ))}
            {filteredOptions.length === 0 && searchQuery.trim().length > 0 ? (
              <div className="selection-empty-state" role="status">
                Keine Treffer für diese Suche.
              </div>
            ) : null}
          </div>
          {canScrollDown ? (
            <div className="selection-scroll-hint" aria-hidden="true">
              <span>Weitere Einträge</span>
              <IconChevronDown size={18} stroke={2} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
