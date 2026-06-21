import { usePoiLocationMap } from './poi.location-map.hook.js';

export function PoiLocationMap({
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
  const { containerRef } = usePoiLocationMap({ styleUrl, latitude, longitude, onCoordinatesChange, onError });

  return <div ref={containerRef} className="min-h-[320px] w-full overflow-hidden rounded-xl border border-border/70" />;
}
