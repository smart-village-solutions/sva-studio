import React from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';

export const PublicWasteSelectionResults = (
  props: Readonly<{
    activeOptionIndex: number;
    canScrollDown: boolean;
    comboboxId: string;
    filteredOptions: readonly PublicWasteSelectableEntry[];
    nextStepLabel: string;
    onActivateOption: (index: number) => void;
    onScroll: () => void;
    onSelectOption: (optionId: string) => void;
    resultsId: string;
    resultsRef: React.RefObject<HTMLDivElement | null>;
    searchQuery: string;
  }>
) => (
  <div className="selection-results-shell">
    <div
      id={props.resultsId}
      ref={props.resultsRef}
      className="selection-results"
      role="listbox"
      aria-label={`${props.nextStepLabel}-Auswahl`}
      onScroll={props.onScroll}
    >
      {props.filteredOptions.map((option, index) => (
        <button
          key={option.id}
          id={`${props.comboboxId}-option-${option.id}`}
          type="button"
          className={`selection-result${
            props.activeOptionIndex === index ? ' selection-result--active' : ''
          }`}
          role="option"
          aria-label={option.label}
          aria-selected={props.activeOptionIndex === index}
          tabIndex={-1}
          onClick={() => props.onSelectOption(option.id)}
          onMouseEnter={() => props.onActivateOption(index)}
        >
          <span className="selection-result-label">{option.label}</span>
          <span className="selection-result-action">
            <span>Übernehmen</span>
            <IconChevronRight size={18} stroke={1.75} aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
    {props.filteredOptions.length === 0 && props.searchQuery.trim().length > 0 ? (
      <div className="selection-empty-state" role="status">
        Keine Treffer für diese Suche.
      </div>
    ) : null}
    {props.canScrollDown ? (
      <div className="selection-scroll-hint" aria-hidden="true">
        <span>Weitere Einträge</span>
        <IconChevronDown size={18} stroke={2} />
      </div>
    ) : null}
  </div>
);
