import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PoiLocationMap } from '../src/poi.location-map.js';
import {
  defaultPoiMapCenter,
  defaultPoiMapZoom,
  focusedPoiMapZoom,
} from '../src/poi.location-map.shared.js';

const maplibreState = vi.hoisted(() => ({
  clickHandler: null as null | ((event: { lngLat: { lng: number; lat: number } }) => void),
  errorHandler: null as null | ((event?: unknown) => void),
  markerDragHandler: null as null | (() => void),
  markerLngLat: { lng: 0, lat: 0 },
  constructorOptions: null as null | { center: [number, number]; zoom: number },
  mapConstructorCalls: 0,
  setCenter: vi.fn(),
  setZoom: vi.fn(),
  reset() {
    this.clickHandler = null;
    this.errorHandler = null;
    this.markerDragHandler = null;
    this.markerLngLat = { lng: 0, lat: 0 };
    this.constructorOptions = null;
    this.mapConstructorCalls = 0;
    this.setCenter.mockReset();
    this.setZoom.mockReset();
  },
  triggerMapClick(lng: number, lat: number) {
    this.clickHandler?.({ lngLat: { lng, lat } });
  },
  triggerMarkerDrag(lng: number, lat: number) {
    this.markerLngLat = { lng, lat };
    this.markerDragHandler?.();
  },
  triggerMapError(event?: unknown) {
    this.errorHandler?.(event);
  },
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    public constructor(options: { center: [number, number]; zoom: number }) {
      maplibreState.mapConstructorCalls += 1;
      maplibreState.constructorOptions = options;
    }

    public on(event: string, handler: (...args: never[]) => void) {
      if (event === 'click') {
        maplibreState.clickHandler = handler as (event: { lngLat: { lng: number; lat: number } }) => void;
      }
      if (event === 'error') {
        maplibreState.errorHandler = handler as () => void;
      }
      return this;
    }

    public remove() {
      return this;
    }

    public setCenter = maplibreState.setCenter;
    public setZoom = maplibreState.setZoom;
  }

  class MockMarker {
    public on(event: string, handler: () => void) {
      if (event === 'dragend') {
        maplibreState.markerDragHandler = handler;
      }
      return this;
    }

    public setLngLat(lngLat: readonly [number, number]) {
      maplibreState.markerLngLat = { lng: lngLat[0], lat: lngLat[1] };
      return this;
    }

    public addTo() {
      return this;
    }

    public getLngLat() {
      return maplibreState.markerLngLat;
    }

    public remove() {
      return this;
    }
  }

  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
    },
    Map: MockMap,
    Marker: MockMarker,
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

describe('PoiLocationMap', () => {
  afterEach(() => {
    maplibreState.reset();
  });

  it('propagates map clicks as normalized coordinates', async () => {
    const onCoordinatesChange = vi.fn();

    render(
      <PoiLocationMap
        styleUrl="https://tiles.example/style.json"
        onCoordinatesChange={onCoordinatesChange}
        onError={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(maplibreState.constructorOptions).toBeTruthy();
    });

    maplibreState.triggerMapClick(13.401, 52.51);

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '52.510000',
      longitude: '13.401000',
    });
    expect(maplibreState.constructorOptions).toEqual(
      expect.objectContaining({
        center: [defaultPoiMapCenter.longitude, defaultPoiMapCenter.latitude],
        zoom: defaultPoiMapZoom,
      }),
    );
  });

  it('propagates draggable marker updates back to the editor', async () => {
    const onCoordinatesChange = vi.fn();

    render(
      <PoiLocationMap
        styleUrl="https://tiles.example/style.json"
        latitude="48.100000"
        longitude="11.500000"
        onCoordinatesChange={onCoordinatesChange}
        onError={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(maplibreState.constructorOptions).toBeTruthy();
    });

    maplibreState.triggerMarkerDrag(11.6, 48.2);

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '48.200000',
      longitude: '11.600000',
    });
    expect(maplibreState.constructorOptions).toEqual(
      expect.objectContaining({
        center: [11.5, 48.1],
        zoom: focusedPoiMapZoom,
      }),
    );
    expect(maplibreState.setCenter).toHaveBeenCalledWith([11.5, 48.1]);
    expect(maplibreState.setZoom).toHaveBeenCalledWith(focusedPoiMapZoom);
  });

  it('logs maplibre render errors with the style url', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <PoiLocationMap
        styleUrl="https://tiles.example/style.json"
        latitude="48.100000"
        longitude="11.500000"
        onCoordinatesChange={() => undefined}
        onError={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(maplibreState.constructorOptions).toBeTruthy();
    });

    maplibreState.triggerMapError({
      sourceId: 'basemap',
      error: {
        message: 'Style not found',
        status: 404,
        url: 'https://tiles.example/style.json',
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'POI map render failed',
      expect.objectContaining({
        style_url: 'https://tiles.example/style.json',
        source_id: 'basemap',
        provider_status: 404,
      }),
    );

    warnSpy.mockRestore();
  });

  it('keeps the existing map instance while coordinates change', async () => {
    const { rerender } = render(
      <PoiLocationMap
        styleUrl="https://tiles.example/style.json"
        latitude="48.100000"
        longitude="11.500000"
        onCoordinatesChange={() => undefined}
        onError={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(maplibreState.constructorOptions).toBeTruthy();
    });

    rerender(
      <PoiLocationMap
        styleUrl="https://tiles.example/style.json"
        latitude="48.200000"
        longitude="11.600000"
        onCoordinatesChange={() => undefined}
        onError={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(maplibreState.mapConstructorCalls).toBe(1);
    });

    expect(maplibreState.setCenter).toHaveBeenCalledWith([11.6, 48.2]);
    expect(maplibreState.setZoom).toHaveBeenCalledWith(focusedPoiMapZoom);
  });
});
