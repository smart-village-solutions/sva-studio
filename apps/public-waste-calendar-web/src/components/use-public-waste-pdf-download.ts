import React from 'react';
import { PublicWasteApiOriginContext } from '../lib/public-waste-api-context.js';

import type { PublicWasteResolvedSelection } from '../lib/public-waste-contract.js';
import { requestPublicWastePdf } from '../lib/public-waste-api.js';
import {
  combinePublicWastePdfFractionOptions,
  type PublicWasteCalendarViewModel,
} from '../lib/public-waste-view-model.js';

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
  const fractionOptions = React.useMemo(
    () =>
      combinePublicWastePdfFractionOptions(calendarModel.fractionOptions, calendarModel.pdfAvailability),
    [calendarModel.fractionOptions, calendarModel.pdfAvailability]
  );
  const [selectedFractions, setSelectedFractions] = React.useState<readonly string[]>(() =>
    fractionOptions.map((fraction) => fraction.id)
  );
  const [pdfRunningYear, setPdfRunningYear] = React.useState<number | null>(null);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const downloadableYears = new Set(
    calendarModel.pdfAvailability
      ?.filter((entry) => entry.fractionOptions.some(({ id }) => selectedFractions.includes(id)))
      .map(({ year }) => year) ??
      calendarModel.listEntries
        .filter(({ fractionId }) => selectedFractions.includes(fractionId))
        .map(({ date }) => Number(date.slice(0, 4)))
  );
  const pdfYears = [...downloadableYears].sort((left, right) => left - right);

  React.useEffect(() => {
    setSelectedFractions(fractionOptions.map((fraction) => fraction.id));
  }, [calendarModel.locationKey, fractionOptions]);

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
    if (!downloadableYears.has(year) || pdfRunningYear !== null) {
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
    fractionOptions,
    selectedFractions,
    pdfYears,
    pdfRunningYear,
    pdfError,
    toggleFraction,
    downloadPdf,
  };
};
