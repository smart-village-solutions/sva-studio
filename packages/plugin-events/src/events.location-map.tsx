import * as React from 'react';

import { useEventLocationMap } from './events.location-map.hook.js';
import { loadEventLocationMapRuntime, type EventMapLibreModule } from './events.location-map.runtime.js';

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

  const { containerRef } = useEventLocationMap({
    runtime,
    styleUrl,
    latitude,
    longitude,
    onCoordinatesChange,
    onError,
  });

  return <div ref={containerRef} className="min-h-[320px] w-full overflow-hidden rounded-xl border border-border/70" />;
}
