import { useEffect, useState } from 'react';
import { getHostMapGeocodingConfig, usePluginTranslation } from '@sva/plugin-sdk';
import { useStudioLocationMap, type StudioLocationMapRuntime } from '@sva/studio-ui-react';

let runtime: Promise<typeof import('maplibre-gl')> | undefined;
const load = () =>
  (runtime ??= Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
    .then(([module]) => module)
    .catch((error: unknown) => {
      runtime = undefined;
      throw error;
    }));
export function ConstructionSiteMap(
  props: Readonly<{
    latitude: number | null;
    longitude: number | null;
    disabled?: boolean;
    onChange: (latitude: number, longitude: number) => void;
  }>
) {
  const pt = usePluginTranslation('construction-sites');
  const [mapRuntime, setMapRuntime] = useState<StudioLocationMapRuntime | null>(null);
  const [styleUrl, setStyleUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getHostMapGeocodingConfig()
      .then(async (config) => {
        if (config.killSwitchEnabled || !config.styleUrl) throw new Error('map_unavailable');
        const module = await load();
        if (active) {
          setStyleUrl(config.styleUrl);
          setMapRuntime(module);
        }
      })
      .catch(() => active && setError('map_unavailable'));
    return () => {
      active = false;
    };
  }, []);
  const { containerRef } = useStudioLocationMap({
    runtime: mapRuntime,
    styleUrl,
    latitude: props.latitude === null ? undefined : String(props.latitude),
    longitude: props.longitude === null ? undefined : String(props.longitude),
    onCoordinatesChange: ({ latitude, longitude }) => {
      if (!props.disabled) props.onChange(Number(latitude), Number(longitude));
    },
    onError: setError,
  });
  return (
    <div className="space-y-2">
      {error ? (
        <p role="status" className="text-sm text-muted-foreground">
          {pt('messages.mapUnavailable')}
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="min-h-64 w-full overflow-hidden rounded-xl border border-border"
        inert={props.disabled}
      />
    </div>
  );
}
