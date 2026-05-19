import React from 'react';
import { IconCalendarPlus, IconFileTypePdf, IconPencil } from '@tabler/icons-react';

import type {
  PublicWasteCalendarEntry,
  PublicWasteSelectableEntry,
} from '../lib/public-waste-contract.js';
import {
  filterPublicWasteCalendarFractions,
  type PublicWasteCalendarViewModel,
} from '../lib/public-waste-view-model.js';
import { PublicWasteCalendarPanels } from './public-waste-calendar-panels.js';
import { PublicWasteEventDialog } from './public-waste-event-dialog.js';
import { PublicWasteSelectionForm, type PublicWasteSelectionPathItem } from './public-waste-selection-form.js';

type IncompletePublicWasteAppProps = {
  readonly selectionState: 'incomplete';
  readonly nextStepLabel: string;
  readonly selectionOptions: readonly PublicWasteSelectableEntry[];
  readonly selectionPath: readonly PublicWasteSelectionPathItem[];
  readonly onEditSelectionStep: (stepIndex: number) => void;
  readonly onSelectOption: (optionId: string) => void;
};

type CompletePublicWasteAppProps = {
  readonly selectionState: 'complete';
  readonly selectionSummary: string;
  readonly calendarModel: PublicWasteCalendarViewModel;
  readonly pdfLinks: readonly string[];
  readonly icalUrl: string;
  readonly onChangeLocation: () => void;
};

type PublicWasteAppProps = IncompletePublicWasteAppProps | CompletePublicWasteAppProps;

const splitSelectionSummary = (
  selectionSummary: string
): readonly [cityLine: string, streetLine: string, houseNumberLine?: string] => {
  const [cityPart = '', remainderPart = ''] = selectionSummary.split(',').map((part) => part.trim());
  const remainder = remainderPart.trim();

  if (remainder.length === 0) {
    return [cityPart, ''];
  }

  if (remainder.endsWith('Alle Hausnummern')) {
    const streetLine = remainder.slice(0, Math.max(0, remainder.length - 'Alle Hausnummern'.length)).trim();
    return [cityPart, streetLine, 'Alle Hausnummern'];
  }

  const houseNumberMatch = remainder.match(/^(.*)\s+([0-9]+[A-Za-z]?([/-][0-9]+[A-Za-z]?)?)$/u);
  if (!houseNumberMatch) {
    return [cityPart, remainder];
  }

  const streetLine = houseNumberMatch[1]?.trim() ?? remainder;
  const houseNumberLine = houseNumberMatch[2]?.trim();
  return [cityPart, streetLine, houseNumberLine];
};

export function PublicWasteApp(props: Readonly<PublicWasteAppProps>) {
  if (props.selectionState === 'incomplete') {
    return (
      <PublicWasteSelectionForm
        nextStepLabel={props.nextStepLabel}
        options={props.selectionOptions}
        selectionPath={props.selectionPath}
        onEditStep={props.onEditSelectionStep}
        onSelectOption={props.onSelectOption}
      />
    );
  }

  return <CompletePublicWasteApp {...props} />;
}

function CompletePublicWasteApp(props: Readonly<CompletePublicWasteAppProps>) {
  const [selectedFractions, setSelectedFractions] = React.useState<readonly string[]>(() =>
    props.calendarModel.fractionOptions.map((fraction) => fraction.id)
  );
  const [selectedEntry, setSelectedEntry] = React.useState<PublicWasteCalendarEntry | null>(null);
  const deferredFractions = React.useDeferredValue(selectedFractions);
  const filteredModel = filterPublicWasteCalendarFractions(props.calendarModel, deferredFractions);
  const [cityLine, streetLine, houseNumberLine] = splitSelectionSummary(props.selectionSummary);
  const currentYearPdf = props.pdfLinks[1];

  React.useEffect(() => {
    setSelectedFractions(props.calendarModel.fractionOptions.map((fraction) => fraction.id));
  }, [props.calendarModel.locationKey, props.calendarModel.fractionOptions]);

  const toggleFraction = (fractionId: string) => {
    setSelectedFractions((current) =>
      current.includes(fractionId) ? current.filter((entry) => entry !== fractionId) : [...current, fractionId]
    );
  };

  return (
    <section className="selection-panel">
      <div className="selection-header">
        <div className="selection-header-main">
          <h2 className="section-title">Abholort</h2>
          <div className="selection-summary-block">
            <p className="selection-summary-line">{cityLine}</p>
            <p className="selection-summary-line">{streetLine}</p>
            {houseNumberLine ? <p className="selection-summary-line">{houseNumberLine}</p> : null}
          </div>
          <div className="selection-summary-action-row">
            <button type="button" className="selection-summary-link" onClick={props.onChangeLocation}>
              <IconPencil size={18} stroke={1.75} aria-hidden="true" />
              <span>Adresse ändern</span>
            </button>
          </div>
        </div>
        <div className="selection-header-actions">
          <a href={props.icalUrl} className="header-action-link">
            <IconCalendarPlus size={18} stroke={1.75} aria-hidden="true" />
            <span>In Kalender übernehmen</span>
          </a>
          {!currentYearPdf ? null : (
            <a href={currentYearPdf} className="header-action-link">
              <IconFileTypePdf size={18} stroke={1.75} aria-hidden="true" />
              <span>Druckversion herunterladen</span>
            </a>
          )}
        </div>
      </div>
      <PublicWasteCalendarPanels
        model={filteredModel}
        onToggleFraction={toggleFraction}
        onActivateEntry={setSelectedEntry}
      />
      <PublicWasteEventDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </section>
  );
}
