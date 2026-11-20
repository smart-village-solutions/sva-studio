import React from 'react';
import { PublicWasteApiOriginContext } from '../lib/public-waste-api-context.js';

import type { PublicWasteResolvedSelection } from '../lib/public-waste-contract.js';
import { requestPublicWastePdf } from '../lib/public-waste-api.js';
import type { PublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';

type UsePublicWastePdfDownloadInput = {
  readonly selection: PublicWasteResolvedSelection;
  readonly calendarModel: PublicWasteCalendarViewModel;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
};

export const usePublicWastePdfDownload = ({
  selection,
  calendarModel,
}: UsePublicWastePdfDownloadInput) => {
  const apiOrigin = React.useContext(PublicWasteApiOriginContext);
  const [selectedFractions, setSelectedFractions] = React.useState<readonly string[]>(() =>
    calendarModel.fractionOptions.map((fraction) => fraction.id)
  );
  const [pdfRunningYear, setPdfRunningYear] = React.useState<number | null>(null);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const selectedFractionsByYear = new Map<number, boolean>();
  for (const { date, fractionId } of calendarModel.listEntries) {
    const year = Number(date.slice(0, 4));
    if (!selectedFractionsByYear.get(year)) {
      selectedFractionsByYear.set(year, selectedFractions.includes(fractionId));
    }
  }
  const pdfYears = Array.from(selectedFractionsByYear, ([year, hasSelectedFractions]) => ({
    year,
    hasSelectedFractions,
  })).sort((left, right) => left.year - right.year);

  React.useEffect(() => {
    setSelectedFractions(calendarModel.fractionOptions.map((fraction) => fraction.id));
  }, [calendarModel.locationKey, calendarModel.fractionOptions]);

  React.useEffect(() => {
    setPdfError(null);
  }, [calendarModel.locationKey]);

  const toggleFraction = (fractionId: string) => {
    setSelectedFractions((current) =>
      current.includes(fractionId)
        ? current.filter((entry) => entry !== fractionId)
        : [...current, fractionId]
    );
  };

  const downloadPdf = async (year: number) => {
    if (!selectedFractionsByYear.get(year) || pdfRunningYear !== null) {
      return;
    }

    setPdfRunningYear(year);
    setPdfError(null);

    try {
      const { blob, filename } = await requestPublicWastePdf(
        {
          selection,
          year,
          fractionIds: selectedFractions,
        },
        apiOrigin
      );
      downloadBlob(blob, filename);
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : 'Die PDF-Datei konnte nicht erzeugt werden.'
      );
    } finally {
      setPdfRunningYear(null);
    }
  };

  return {
    selectedFractions,
    pdfYears,
    pdfRunningYear,
    pdfError,
    toggleFraction,
    downloadPdf,
  };
};
