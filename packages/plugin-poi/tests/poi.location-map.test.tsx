import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PoiLocationMap } from '../src/poi.location-map.js';

const maplibreState = vi.hoisted(() => ({
  clickHandler: null as null | ((event: { lngLat: { lng: number; lat: number } }) => void),
  errorHandler: null as null | (() => void),
  markerDragHandler: null as null | (() => void),
  markerLngLat: { lng: 0, lat: 0 },
  setCenter: vi.fn(),
  setZoom: vi.fn(),
  reset() {
    this.clickHandler = null;
    this.errorHandler = null;
    this.markerDragHandler = null;
    this.markerLngLat = { lng: 0, lat: 0 };
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
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
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

describe('PoiLocationMap', () => {
  afterEach(() => {
    maplibreState.reset();
  });

  it('propagates map clicks as normalized coordinates', () => {
    const onCoordinatesChange = vi.fn();

    render(
      <PoiLocationMap
        styleUrl="https://tiles.example/style.json"
        onCoordinatesChange={onCoordinatesChange}
        onError={() => undefined}
      />,
    );

    maplibreState.triggerMapClick(13.401, 52.51);

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '52.510000',
      longitude: '13.401000',
    });
  });

  it('propagates draggable marker updates back to the editor', () => {
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

    maplibreState.triggerMarkerDrag(11.6, 48.2);

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '48.200000',
      longitude: '11.600000',
    });
  });
});
