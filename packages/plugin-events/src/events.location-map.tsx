import {
  readMapStylePreferenceKey,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import * as React from 'react';
import {
  useStudioLocationMap,
  useStudioMapStyle,
  StudioMapStyleControl,
} from '@sva/studio-ui-react';

import {
  loadEventLocationMapRuntime,
  type EventMapLibreModule,
} from './events.location-map.runtime.js';

export function EventsLocationMap({
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: Readonly<{
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>) {
  const [runtime, setRuntime] = React.useState<EventMapLibreModule | null>(null);

  React.useEffect(() => {
    let active = true;

    void loadEventLocationMapRuntime()
      .then((nextRuntime) => {
        if (!active) {
          return;
        }
        setRuntime(nextRuntime);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        onError('map_error');
      });

    return () => {
      active = false;
    };
  }, [onError]);

  const preferenceKey = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readMapStylePreferenceKey,
    readMapStylePreferenceKey
  );
  const mapStyle = useStudioMapStyle(styleUrl, preferenceKey);
  const mapT = usePluginTranslation('shared');
  const { containerRef } = useStudioLocationMap({
    runtime,
    styleUrl: mapStyle.styleUrl,
    latitude,
    longitude,
    onCoordinatesChange,
    onError,
  });

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="min-h-[320px] w-full overflow-hidden rounded-lg border border-border/70"
      />
      <StudioMapStyleControl
        t={mapT}
        styleUrl={mapStyle.styleUrl}
        onChange={mapStyle.chooseStyle}
        disabled={!runtime}
      />
    </div>
  );
}
