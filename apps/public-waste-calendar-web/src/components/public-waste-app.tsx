import React from 'react';

import type { PublicWasteCalendarResponse } from '../lib/public-waste-api.js';
import type {
  PublicWasteCalendarEntry,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
} from '../lib/public-waste-contract.js';
import {
  filterPublicWasteCalendarFractions,
  type PublicWasteCalendarViewModel,
} from '../lib/public-waste-view-model.js';
import { PublicWasteActionHub } from './public-waste-action-hub.js';
import { PublicWasteCalendarPanels } from './public-waste-calendar-panels.js';
import { PublicWasteEventDialog } from './public-waste-event-dialog.js';
import { PublicWasteSelectionHeader } from './public-waste-selection-header.js';
import {
  PublicWasteSelectionForm,
  type PublicWasteSelectionPathItem,
} from './public-waste-selection-form.js';
import { usePublicWastePdfDownload } from './use-public-waste-pdf-download.js';

type IncompletePublicWasteAppProps = {
  readonly selectionState: 'incomplete';
  readonly nextStepLabel: string;
  readonly selectionOptions: readonly PublicWasteSelectableEntry[];
  readonly selectionPath: readonly PublicWasteSelectionPathItem[];
  readonly onEditSelectionStep: (stepIndex: number) => void;
  readonly onSelectOption: (optionId: string) => void;
};

type CompletePublicWasteAppProps = {
  readonly selection: PublicWasteResolvedSelection;
  readonly selectionState: 'complete';
  readonly selectionSummary: string;
  readonly calendarModel: PublicWasteCalendarViewModel;
  readonly icalUrl: string;
  readonly calendarReminderOptions?: PublicWasteCalendarResponse['calendarReminderOptions'];
  readonly reminderSignup?: PublicWasteCalendarResponse['reminderSignup'];
  readonly onChangeLocation: () => void;
};

type PublicWasteAppProps = IncompletePublicWasteAppProps | CompletePublicWasteAppProps;

const splitSelectionSummary = (
  selectionSummary: string
): readonly [cityLine: string, streetLine: string, houseNumberLine?: string] => {
  const [cityPart = '', remainderPart = ''] = selectionSummary
    .split(',')
    .map((part) => part.trim());
  const remainder = remainderPart.trim();

  if (remainder.length === 0) {
    return [cityPart, ''];
  }

  if (remainder.endsWith('Alle Hausnummern')) {
    const streetLine = remainder
      .slice(0, Math.max(0, remainder.length - 'Alle Hausnummern'.length))
      .trim();
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
  const [selectedEntry, setSelectedEntry] = React.useState<PublicWasteCalendarEntry | null>(null);
  const pdf = usePublicWastePdfDownload({
    selection: props.selection,
    calendarModel: props.calendarModel,
  });
  const deferredFractions = React.useDeferredValue(pdf.selectedFractions);
  const filteredModel = filterPublicWasteCalendarFractions(props.calendarModel, deferredFractions);
  const [cityLine, streetLine, houseNumberLine] = splitSelectionSummary(props.selectionSummary);

  return (
    <section className="selection-panel">
      <PublicWasteSelectionHeader
        cityLine={cityLine}
        streetLine={streetLine}
        houseNumberLine={houseNumberLine}
        fractionOptions={props.calendarModel.fractionOptions}
        activeFractionIds={pdf.selectedFractions}
        onChangeLocation={props.onChangeLocation}
        onToggleFraction={pdf.toggleFraction}
      />
      <PublicWasteActionHub
        selection={props.selection}
        selectionSummary={props.selectionSummary}
        locationKey={props.calendarModel.locationKey}
        fractionOptions={props.calendarModel.fractionOptions}
        selectedFractions={pdf.selectedFractions}
        calendarReminderOptions={props.calendarReminderOptions}
        reminderSignup={props.reminderSignup}
        pdfYear={pdf.pdfYear}
        pdfRunning={pdf.pdfRunning}
        pdfError={pdf.pdfError}
        yearOptions={pdf.yearOptions}
        setPdfYear={pdf.setPdfYear}
        downloadPdf={pdf.downloadPdf}
      />
      <PublicWasteCalendarPanels model={filteredModel} onActivateEntry={setSelectedEntry} />
      <PublicWasteEventDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </section>
  );
}
