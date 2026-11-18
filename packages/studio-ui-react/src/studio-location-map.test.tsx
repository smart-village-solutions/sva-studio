import { act, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStudioLocationMap, type StudioLocationMapRuntime } from './studio-location-map.js';

const preparation = vi.hoisted(() => ({ run: vi.fn(async () => undefined) }));
vi.mock('./studio-map-style.js', async (original) => ({
  ...(await original<typeof import('./studio-map-style.js')>()),
  prepareStudioMapRuntime: preparation.run,
}));

type Handler = (event?: { lngLat?: { lat: number; lng: number } }) => void;

class FakeMap {
  static readonly instances: FakeMap[] = [];
  readonly handlers = new Map<string, Handler>();
  readonly options: { center: [number, number]; zoom: number };
  readonly centers: Array<[number, number]> = [];
  readonly zooms: number[] = [];
  removed = false;
  readonly styles: string[] = [];
  setStyle(style: string) {
    this.styles.push(style);
  }

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
    return { lat: this.lngLat[1], lng: this.lngLat[0] };
  }
  remove(): void {
    this.removed = true;
  }
}

const runtime: StudioLocationMapRuntime = { Map: FakeMap, Marker: FakeMarker };

const MapHarness = ({
  latitude,
  longitude,
  onCoordinatesChange = vi.fn(),
  onError = vi.fn(),
  mapRuntime = runtime,
  styleUrl = 'https://tiles.example.test/style.json',
}: Readonly<{
  latitude?: string;
  longitude?: string;
  onCoordinatesChange?: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError?: (message: string | null) => void;
  mapRuntime?: StudioLocationMapRuntime;
  styleUrl?: string;
}>) => {
  const { containerRef } = useStudioLocationMap({
    runtime: mapRuntime,
    styleUrl,
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

describe('useStudioLocationMap', () => {
  it('uses the latest committed coordinates and style after lazy protocol preparation', async () => {
    let ready: (() => void) | undefined;
    preparation.run.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        ready = resolve;
      })
    );
    const base = '/api/v1/iam/map-geocoding/mapstick/styles/';
    const view = render(
      <MapHarness latitude="51" longitude="12" styleUrl={`${base}osm-bright/style.json`} />
    );
    expect(FakeMap.instances).toHaveLength(0);
    view.rerender(
      <MapHarness latitude="52" longitude="13" styleUrl={`${base}fiord-color/style.json`} />
    );
    await act(async () => ready?.());
    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    expect(FakeMap.instances[0]?.options).toMatchObject({
      center: [13, 52],
      style: `${base}fiord-color/style.json`,
    });
    expect(FakeMarker.instances[0]?.lngLat).toEqual([13, 52]);
  });

  it('switches style without recreating the map, marker or resetting the camera', async () => {
    const view = render(<MapHarness latitude="52" longitude="13" />);
    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const map = FakeMap.instances[0];
    if (!map) throw new Error('missing_map_instance');
    const initialCenters = map.centers.length;
    const initialZooms = map.zooms.length;
    view.rerender(
      <MapHarness latitude="52" longitude="13" styleUrl="https://tiles.example.test/other.json" />
    );
    expect(map.styles).toEqual(['https://tiles.example.test/other.json']);
    expect(FakeMap.instances).toHaveLength(1);
    expect(FakeMarker.instances).toHaveLength(1);
    expect(map.centers).toHaveLength(initialCenters);
    expect(map.zooms).toHaveLength(initialZooms);
    expect(map.removed).toBe(false);
  });

  it('creates the map and propagates map clicks and marker drags', async () => {
    const onCoordinatesChange = vi.fn();
    const onError = vi.fn();
    render(
      <MapHarness
        latitude="51.5"
        longitude="7.4"
        onCoordinatesChange={onCoordinatesChange}
        onError={onError}
      />
    );

    await waitFor(() => expect(FakeMarker.instances).toHaveLength(1));
    const map = FakeMap.instances[0];
    const marker = FakeMarker.instances[0];
    expect(map?.options).toMatchObject({ center: [7.4, 51.5], zoom: 19 });
    expect(marker?.options).toEqual({ color: 'rgb(0, 90, 158)', draggable: true });
    expect(onError).toHaveBeenCalledWith(null);

    act(() => map?.handlers.get('click')?.({ lngLat: { lat: 51.6123456, lng: 7.5234567 } }));
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '51.612346',
      longitude: '7.523457',
    });

    marker?.setLngLat([7.6, 51.7]);
    act(() => marker?.handlers.get('dragend')?.());
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '51.700000',
      longitude: '7.600000',
    });
  });

  it('updates the viewport, removes invalid markers, and cleans up exactly once', async () => {
    const view = render(<MapHarness latitude="51.5" longitude="7.4" />);
    await waitFor(() => expect(FakeMarker.instances).toHaveLength(1));
    const map = FakeMap.instances[0];
    const marker = FakeMarker.instances[0];

    view.rerender(<MapHarness latitude="52.1" longitude="8.2" />);
    await waitFor(() => expect(map?.centers.at(-1)).toEqual([8.2, 52.1]));

    view.rerender(<MapHarness latitude="" longitude="8.2" />);
    await waitFor(() => {
      expect(marker?.removed).toBe(true);
      expect(map?.centers.at(-1)).toEqual([10.447683, 51.163361]);
      expect(map?.zooms.at(-1)).toBe(5.8);
    });
    view.unmount();
    expect(map?.removed).toBe(true);
  });

  it('reports construction and runtime errors', async () => {
    const constructionError = vi.fn();
    render(
      <MapHarness
        mapRuntime={{
          Map: class ThrowingMap {
            constructor() {
              throw new Error('map unavailable');
            }
          } as never,
          Marker: FakeMarker,
        }}
        onError={constructionError}
      />
    );
    await waitFor(() => expect(constructionError).toHaveBeenCalledWith('map_error'));

    const runtimeError = vi.fn();
    render(<MapHarness onError={runtimeError} />);
    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    act(() => FakeMap.instances[0]?.handlers.get('error')?.());
    expect(runtimeError).toHaveBeenCalledWith('map_error');
  });
});
