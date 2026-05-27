import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioEmptyState, StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useMemo, useState, type FormEvent } from 'react';

import {
  createWasteManagementOutputPdf,
  type WasteManagementOutputPdfResult,
} from './waste-management.api.js';
import { resolveApiErrorCode, StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { useWasteOutputPanelData } from './waste-management.output-panel.data.js';
import {
  buildOutputLocationOptions,
  findOutputArtifacts,
  isOutputYearValid,
  parseOutputYear,
  upsertGeneratedPdf,
} from './waste-management.output-panel.model.js';
import {
  WasteOutputExistingSection,
  WasteOutputFormSection,
  WasteOutputLatestResultSection,
} from './waste-management.output-panel.parts.js';

const renderEmptyState = (translate: ReturnType<typeof usePluginTranslation>) => (
  <StudioEmptyState>
    <div className="space-y-2 text-left">
      <p className="font-medium">{translate('output.pdf.empty.title')}</p>
      <p>{translate('output.pdf.empty.body')}</p>
    </div>
  </StudioEmptyState>
);

const resolveOutputGenerationMessage = (
  translate: ReturnType<typeof usePluginTranslation>,
  generationError: unknown
): string => {
  const code = resolveApiErrorCode(generationError);
  if (code === 'forbidden') {
    return translate('output.pdf.messages.generateForbidden');
  }

  return translate('output.pdf.messages.generateError');
};

export const WasteOutputPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const { error, loading, locationData, outputOverview, setOutputOverview } = useWasteOutputPanelData(pt);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [latestResult, setLatestResult] = useState<WasteManagementOutputPdfResult | null>(null);
  const collectionLocationOptions = useMemo(() => buildOutputLocationOptions(locationData), [locationData]);
  const selectedLocationArtifacts = useMemo(
    () => findOutputArtifacts(outputOverview, selectedLocationId),
    [outputOverview, selectedLocationId]
  );
  const normalizedYear = parseOutputYear(year);
  const yearValid = isOutputYearValid(normalizedYear);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocationId || !yearValid) {
      return;
    }

    setRunning(true);
    setMessage(null);

    try {
      const result = await createWasteManagementOutputPdf({
        collectionLocationId: selectedLocationId,
        year: normalizedYear,
      });
      setLatestResult(result);
      setOutputOverview((current) => upsertGeneratedPdf(current, result));
      setMessage({ kind: 'success', text: pt('output.pdf.messages.generateSuccess') });
    } catch (generationError) {
      setMessage({
        kind: 'error',
        text: resolveOutputGenerationMessage(pt, generationError),
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <StudioLoadingState>{pt('output.pdf.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  if (!collectionLocationOptions.length) {
    return renderEmptyState(pt);
  }

  return (
    <div className="space-y-5">
      <StatusNotice message={message} />
      <WasteOutputFormSection
        collectionLocationOptions={collectionLocationOptions}
        onSubmit={onSubmit}
        running={running}
        selectedLocationId={selectedLocationId}
        setSelectedLocationId={setSelectedLocationId}
        setYear={setYear}
        translate={pt}
        year={year}
        yearValid={yearValid}
      />
      <WasteOutputExistingSection pdfs={selectedLocationArtifacts} selectedLocationId={selectedLocationId} translate={pt} />
      {latestResult ? <WasteOutputLatestResultSection result={latestResult} translate={pt} /> : null}
    </div>
  );
};
