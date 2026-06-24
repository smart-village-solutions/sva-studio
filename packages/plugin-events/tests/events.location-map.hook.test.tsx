import { act, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEventLocationMap } from '../src/events.location-map.hook.js';
import type { EventMapLibreModule } from '../src/events.location-map.runtime.js';

type Handler = (event?: { lngLat?: { lat: number; lng: number } }) => void;

class FakeMap {
  static readonly instances: FakeMap[] = [];

  readonly handlers = new Map<string, Handler>();
  readonly options: { center: [number, number]; zoom: number };
  readonly centers: Array<[number, number]> = [];
  readonly zooms: number[] = [];
  removed = false;

  constructor(options: { center: [number, number]; zoom: number }) {
    this.options = options;
    FakeMap.instances.push(this);
  }

  on(eventName: string, handler: Handler): this {
    this.handlers.set(eventName, handler);
    return this;
  }

  setCenter(center: [number, number]): this {
    this.centers.push(center);
    return this;
  }

  setZoom(zoom: number): this {
    this.zooms.push(zoom);
    return this;
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeMarker {
  static readonly instances: FakeMarker[] = [];

  readonly handlers = new Map<string, Handler>();
  readonly options: { color: string; draggable: boolean };
  lngLat: [number, number] = [0, 0];
  removed = false;

  constructor(options: { color: string; draggable: boolean }) {
    this.options = options;
    FakeMarker.instances.push(this);
  }

  setLngLat(lngLat: [number, number]): this {
    this.lngLat = lngLat;
    return this;
  }

  addTo(): this {
    return this;
  }

  on(eventName: string, handler: Handler): this {
    this.handlers.set(eventName, handler);
    return this;
  }

  getLngLat(): { lat: number; lng: number } {
    return {
      lat: this.lngLat[1],
      lng: this.lngLat[0],
    };
  }

  remove(): void {
    this.removed = true;
  }
}

const createRuntime = (): EventMapLibreModule =>
  ({
    Map: FakeMap,
    Marker: FakeMarker,
  }) as unknown as EventMapLibreModule;

type MapHarnessProps = Readonly<{
  runtime: EventMapLibreModule | null;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>;

const MapHarness = ({ runtime, latitude, longitude, onCoordinatesChange, onError }: MapHarnessProps) => {
  const { containerRef } = useEventLocationMap({
    runtime,
    styleUrl: 'https://tiles.example.test/style.json',
    latitude,
    longitude,
    onCoordinatesChange,
    onError,
  });

  return <div data-testid="map-container" ref={containerRef} />;
};

afterEach(() => {
  FakeMap.instances.length = 0;
  FakeMarker.instances.length = 0;
});

describe('useEventLocationMap', () => {
  it('creates the map and propagates map clicks and marker drags', async () => {
    const onCoordinatesChange = vi.fn();
    const onError = vi.fn();

    render(
      <MapHarness
        runtime={createRuntime()}
        latitude="51.5"
        longitude="7.4"
        onCoordinatesChange={onCoordinatesChange}
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(FakeMap.instances).toHaveLength(1);
      expect(FakeMarker.instances).toHaveLength(1);
    });

    const map = FakeMap.instances[0];
    const marker = FakeMarker.instances[0];

    expect(map?.options.center).toEqual([7.4, 51.5]);
    expect(map?.options.zoom).toBe(19);
    expect(marker?.options).toEqual({ color: 'rgb(0, 90, 158)', draggable: true });
    expect(onError).toHaveBeenCalledWith(null);

    act(() => {
      map?.handlers.get('click')?.({ lngLat: { lat: 51.6123456, lng: 7.5234567 } });
    });

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '51.612346',
      longitude: '7.523457',
    });

    marker?.setLngLat([7.6, 51.7]);
    act(() => {
      marker?.handlers.get('dragend')?.();
    });

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '51.700000',
      longitude: '7.600000',
    });
  });

  it('updates the viewport, removes invalid markers, and cleans up the map', async () => {
    const runtime = createRuntime();
    const view = render(
      <MapHarness
        runtime={runtime}
        latitude="51.5"
        longitude="7.4"
        onCoordinatesChange={vi.fn()}
        onError={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(FakeMap.instances).toHaveLength(1);
      expect(FakeMarker.instances).toHaveLength(1);
    });

    const map = FakeMap.instances[0];
    const marker = FakeMarker.instances[0];

    view.rerender(
      <MapHarness
        runtime={runtime}
        latitude="52.1"
        longitude="8.2"
        onCoordinatesChange={vi.fn()}
        onError={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(map?.centers.at(-1)).toEqual([8.2, 52.1]);
      expect(map?.zooms.at(-1)).toBe(19);
    });

    view.rerender(
      <MapHarness
        runtime={runtime}
        latitude=""
        longitude="8.2"
        onCoordinatesChange={vi.fn()}
        onError={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(marker?.removed).toBe(true);
      expect(map?.centers.at(-1)).toEqual([10.447683, 51.163361]);
      expect(map?.zooms.at(-1)).toBe(5.8);
    });

    view.unmount();

    expect(map?.removed).toBe(true);
  });

  it('reports runtime construction errors and map runtime errors', async () => {
    const onError = vi.fn();

    render(
      <MapHarness
        runtime={
          {
            Map: class ThrowingMap {
              constructor() {
                throw new Error('map unavailable');
              }
            },
            Marker: FakeMarker,
          } as unknown as EventMapLibreModule
        }
        latitude="51.5"
        longitude="7.4"
        onCoordinatesChange={vi.fn()}
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('map_error');
    });

    const mapError = vi.fn();
    render(
      <MapHarness
        runtime={createRuntime()}
        latitude="51.5"
        longitude="7.4"
        onCoordinatesChange={vi.fn()}
        onError={mapError}
      />
    );

    await waitFor(() => {
      expect(FakeMap.instances).toHaveLength(1);
    });

    act(() => {
      FakeMap.instances[0]?.handlers.get('error')?.();
    });

    expect(mapError).toHaveBeenCalledWith('map_error');
  });
});
