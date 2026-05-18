import React from 'react';

import { PublicWasteRootDocument } from './__root.js';
import { PublicWasteApp } from '../components/public-waste-app.js';
import type { PublicWasteSelectionState } from '../lib/public-waste-contract.js';
import {
  advanceDemoPublicWasteSelection,
  readDemoPublicWasteSelectionFromCookie,
  resolveDemoPublicWastePageState,
  writeDemoPublicWasteSelectionCookie,
} from '../lib/public-waste-demo-runtime.js';

export function PublicWasteIndexPage() {
  const [selection, setSelection] = React.useState<{
    readonly location: PublicWasteSelectionState | null;
    readonly restoredLocationNotice?: string;
  }>({
    location: null,
  });

  React.useEffect(() => {
    const restoredSelection = readDemoPublicWasteSelectionFromCookie();
    setSelection({
      location: restoredSelection ?? {},
      ...(restoredSelection
        ? { restoredLocationNotice: 'Gespeicherte Adresse geladen. Sie können die Auswahl ändern.' }
        : {}),
    });
  }, []);

  const handleSelectOption = (optionId: string) => {
    if (!selection.location) {
      return;
    }

    const nextSelection = advanceDemoPublicWasteSelection({
      selection: selection.location,
      optionId,
    });

    const nextPageState = resolveDemoPublicWastePageState({
      selection: nextSelection,
    });

    if (nextPageState.selectionState === 'complete') {
      writeDemoPublicWasteSelectionCookie(nextPageState.selection);
    }

    React.startTransition(() => {
      setSelection({
        location: nextSelection,
      });
    });
  };

  const pageState = selection.location
    ? resolveDemoPublicWastePageState({
        selection: selection.location,
        restoredLocationNotice: selection.restoredLocationNotice,
      })
    : null;

  return (
    <PublicWasteRootDocument>
      <main className="panel">
        {!pageState ? (
          <p className="body-copy">Abfallkalender wird geladen.</p>
        ) : pageState.selectionState === 'incomplete' ? (
          <PublicWasteApp
            selectionState="incomplete"
            nextStepLabel={pageState.nextStepLabel}
            selectionOptions={pageState.selectionOptions}
            onSelectOption={handleSelectOption}
          />
        ) : (
          <PublicWasteApp
            selectionState="complete"
            selectionSummary={pageState.selectionSummary}
            calendarModel={pageState.calendarModel}
            pdfLinks={pageState.pdfLinks}
            icalUrl={pageState.icalUrl}
            restoredLocationNotice={pageState.restoredLocationNotice}
          />
        )}
      </main>
    </PublicWasteRootDocument>
  );
}
