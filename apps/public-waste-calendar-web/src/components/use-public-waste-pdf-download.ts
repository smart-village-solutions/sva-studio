import React from 'react';

import type { PublicWasteResolvedSelection } from '../lib/public-waste-contract.js';
import { requestPublicWastePdf } from '../lib/public-waste-api.js';
import type { PublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';

type UsePublicWastePdfDownloadInput = {
  readonly selection: PublicWasteResolvedSelection;
  readonly calendarModel: PublicWasteCalendarViewModel;
};

const currentYear = (): number => new Date().getFullYear();

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

export const usePublicWastePdfDownload = ({ selection, calendarModel }: UsePublicWastePdfDownloadInput) => {
  const [selectedFractions, setSelectedFractions] = React.useState<readonly string[]>(() =>
    calendarModel.fractionOptions.map((fraction) => fraction.id)
  );
  const [pdfYear, setPdfYear] = React.useState(currentYear());
  const [pdfRunning, setPdfRunning] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const yearOptions = React.useMemo(() => {
    const year = currentYear();
    return [year - 1, year, year + 1];
  }, []);

  React.useEffect(() => {
    setSelectedFractions(calendarModel.fractionOptions.map((fraction) => fraction.id));
  }, [calendarModel.locationKey, calendarModel.fractionOptions]);

  React.useEffect(() => {
    setPdfYear(currentYear());
    setPdfError(null);
  }, [calendarModel.locationKey]);

  const toggleFraction = (fractionId: string) => {
    setSelectedFractions((current) =>
      current.includes(fractionId) ? current.filter((entry) => entry !== fractionId) : [...current, fractionId]
    );
  };

  const downloadPdf = async () => {
    if (selectedFractions.length === 0 || pdfRunning) {
      return;
    }

    setPdfRunning(true);
    setPdfError(null);

    try {
      const { blob, filename } = await requestPublicWastePdf({
        selection,
        year: pdfYear,
        fractionIds: selectedFractions,
      });
      downloadBlob(blob, filename);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Die PDF-Datei konnte nicht erzeugt werden.');
    } finally {
      setPdfRunning(false);
    }
  };

  return {
    selectedFractions,
    pdfYear,
    pdfRunning,
    pdfError,
    yearOptions,
    setPdfYear,
    toggleFraction,
    downloadPdf,
  };
};
