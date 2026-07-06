import * as React from 'react';

import { useGenericItemsLocationMap } from './generic-items.location-map.hook.js';
import { loadGenericItemsLocationMapRuntime, type GenericItemsMapLibreModule } from './generic-items.location-map.runtime.js';

export function GenericItemsLocationMap({
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
  const [runtime, setRuntime] = React.useState<GenericItemsMapLibreModule | null>(null);

  React.useEffect(() => {
    let active = true;

    void loadGenericItemsLocationMapRuntime()
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

  const { containerRef } = useGenericItemsLocationMap({
    runtime,
    styleUrl,
    latitude,
    longitude,
    onCoordinatesChange,
    onError,
  });

  return <div ref={containerRef} className="min-h-[320px] w-full overflow-hidden rounded-xl border border-border/70" />;
}
