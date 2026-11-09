import React from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';

export const useSelectionNavigation = (
  input: Readonly<{
    activeOptionIndex: number;
    comboboxId: string;
    filteredOptions: readonly PublicWasteSelectableEntry[];
    onSelectOption: (optionId: string) => void;
    searchQuery: string;
    setActiveOptionIndex: React.Dispatch<React.SetStateAction<number>>;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  }>
) => {
  const activateOption = (index: number) => {
    const option = input.filteredOptions[index];
    if (!option) {
      return;
    }

    input.setActiveOptionIndex(index);
    document
      .getElementById(`${input.comboboxId}-option-${option.id}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && (input.searchQuery.length > 0 || input.activeOptionIndex >= 0)) {
      event.preventDefault();
      input.setSearchQuery('');
      input.setActiveOptionIndex(-1);
      return;
    }

    if (input.filteredOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activateOption(Math.min(input.activeOptionIndex + 1, input.filteredOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activateOption(
        input.activeOptionIndex <= 0
          ? input.filteredOptions.length - 1
          : input.activeOptionIndex - 1
      );
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      activateOption(event.key === 'Home' ? 0 : input.filteredOptions.length - 1);
      return;
    }

    if (event.key === 'Enter' && input.activeOptionIndex >= 0) {
      event.preventDefault();
      const activeOption = input.filteredOptions[input.activeOptionIndex];
      if (activeOption) {
        input.onSelectOption(activeOption.id);
      }
    }
  };

  return { activateOption, handleSearchKeyDown };
};

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
