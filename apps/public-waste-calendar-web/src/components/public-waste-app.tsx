import React from 'react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';
import {
  filterPublicWasteCalendarFractions,
  type PublicWasteCalendarViewModel,
} from '../lib/public-waste-view-model.js';
import { PublicWasteCalendarPanels } from './public-waste-calendar-panels.js';
import { PublicWasteSelectionForm } from './public-waste-selection-form.js';

type IncompletePublicWasteAppProps = {
  readonly selectionState: 'incomplete';
  readonly nextStepLabel: string;
  readonly selectionOptions: readonly PublicWasteSelectableEntry[];
  readonly onSelectOption: (optionId: string) => void;
};

type CompletePublicWasteAppProps = {
  readonly selectionState: 'complete';
  readonly selectionSummary: string;
  readonly calendarModel: PublicWasteCalendarViewModel;
  readonly pdfLinks: readonly string[];
  readonly icalUrl: string;
  readonly restoredLocationNotice?: string;
};

type PublicWasteAppProps = IncompletePublicWasteAppProps | CompletePublicWasteAppProps;

export function PublicWasteApp(props: Readonly<PublicWasteAppProps>) {
  if (props.selectionState === 'incomplete') {
    return (
      <PublicWasteSelectionForm
        nextStepLabel={props.nextStepLabel}
        options={props.selectionOptions}
        onSelectOption={props.onSelectOption}
      />
    );
  }

  const [selectedFractions, setSelectedFractions] = React.useState<readonly string[]>([]);
  const deferredFractions = React.useDeferredValue(selectedFractions);
  const filteredModel = filterPublicWasteCalendarFractions(props.calendarModel, deferredFractions);

  const toggleFraction = (fractionId: string) => {
    setSelectedFractions((current) =>
      current.includes(fractionId) ? current.filter((entry) => entry !== fractionId) : [...current, fractionId]
    );
  };

  return (
    <section className="selection-panel">
      {props.restoredLocationNotice ? <p className="notice-banner">{props.restoredLocationNotice}</p> : null}
      <h2 className="section-title">Abholort</h2>
      <p className="body-copy">{props.selectionSummary}</p>
      <PublicWasteCalendarPanels
        model={filteredModel}
        pdfLinks={props.pdfLinks}
        icalUrl={props.icalUrl}
        onToggleFraction={toggleFraction}
      />
    </section>
  );
}
