import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementOutputOverview,
  type WasteManagementOutputOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { OutputLocationData } from './waste-management.output-panel.model.js';

type OutputTranslate = (key: string) => string;

type WasteOutputPanelDataState = Readonly<{
  loading: boolean;
  error: string | null;
  locationData: OutputLocationData | null;
  outputOverview: WasteManagementOutputOverview | null;
  setOutputOverview: Dispatch<SetStateAction<WasteManagementOutputOverview | null>>;
}>;

const mapLocationData = (overview: Awaited<ReturnType<typeof getWasteManagementMasterDataOverview>>): OutputLocationData => ({
  collectionLocations: overview.collectionLocations,
  regions: overview.regions,
  cities: overview.cities,
  streets: overview.streets,
  houseNumbers: overview.houseNumbers,
});

export const useWasteOutputPanelData = (translate: OutputTranslate): WasteOutputPanelDataState => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<OutputLocationData | null>(null);
  const [outputOverview, setOutputOverview] = useState<WasteManagementOutputOverview | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [overview, outputs] = await Promise.all([
          getWasteManagementMasterDataOverview({ scope: 'locations' }),
          getWasteManagementOutputOverview(),
        ]);
        if (!active) {
          return;
        }
        setLocationData(mapLocationData(overview));
        setOutputOverview(outputs);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        const errorKey =
          resolveApiErrorCode(loadError) === 'forbidden'
            ? 'output.pdf.messages.generateForbidden'
            : 'output.pdf.messages.loadError';
        setError(translate(errorKey));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [translate]);

  return {
    loading,
    error,
    locationData,
    outputOverview,
    setOutputOverview,
  };
};
