import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  config: vi.fn(),
  options: undefined as undefined | { style: string; center: number[] },
  events: {} as Record<string, (event?: unknown) => void>,
  point: vi.fn(),
  draggable: vi.fn(),
  removeMap: vi.fn(),
  removeMarker: vi.fn(),
  stopDraw: vi.fn(),
}));
vi.mock('@sva/plugin-sdk', () => ({
  getHostMapGeocodingConfig: host.config,
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }));
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  AttributionControl: class {},
  Map: class {
    constructor(options: { style: string; center: number[] }) {
      host.options = options;
    }
    addControl = vi.fn();
    on(name: string, listener: (event?: unknown) => void) {
      host.events[name] = listener;
    }
    remove = host.removeMap;
  },
  Marker: class {
    setLngLat(point: number[]) {
      host.point(point);
      return this;
    }
    addTo() {
      return this;
    }
    on = vi.fn();
    setDraggable = host.draggable;
    remove = host.removeMarker;
  },
}));
// Only unit-test map lifecycle here; the browser suite uses real MapLibre/Terra Draw.
vi.mock('terra-draw-maplibre-gl-adapter', () => ({ TerraDrawMapLibreGLAdapter: class {} }));
vi.mock('terra-draw', async (original) => ({
  ...(await original<object>()),
  TerraDraw: class {
    mode = 'select';
    start = vi.fn();
    stop = host.stopDraw;
    setModeStyles = vi.fn();
    addFeatures = vi.fn();
    clearUndoRedoHistory = vi.fn();
    setMode(mode: string) {
      this.mode = mode;
    }
    getMode() {
      return this.mode;
    }
    getSnapshot() {
      return [];
    }
    getSnapshotFeature() {
      return undefined;
    }
    on = vi.fn();
  },
}));
import { ConstructionSiteMap } from '../src/construction-sites.map.js';

beforeEach(() => {
  vi.clearAllMocks();
  host.options = undefined;
  host.events = {};
});
afterEach(cleanup);
describe('construction site configured map', () => {
  it('uses the host style, preserves zero coordinates and removes mutation handlers in readonly mode', async () => {
    host.config.mockResolvedValue({
      styleUrl: 'https://maps.test/style.json',
      killSwitchEnabled: false,
    });
    const change = vi.fn();
    const geometryChange = vi.fn();
    const { rerender, unmount } = render(
      <ConstructionSiteMap
        latitude={0}
        longitude={0}
        onChange={change}
        onGeometryChange={geometryChange}
      />
    );
    await waitFor(() => expect(host.options?.style).toBe('https://maps.test/style.json'));
    expect(host.options?.center).toEqual([0, 0]);
    expect(host.point).toHaveBeenCalledWith([0, 0]);
    act(() => host.events.load?.());
    fireEvent.click(screen.getByRole('button', { name: 'geometry.location' }));
    act(() => host.events.click?.({ lngLat: { lat: 1.0000004, lng: 2 } }));
    expect(change).toHaveBeenCalledWith(1, 2);
    rerender(
      <ConstructionSiteMap
        latitude={null}
        longitude={null}
        onChange={change}
        onGeometryChange={geometryChange}
        disabled
      />
    );
    act(() => host.events.click?.({ lngLat: { lat: 3, lng: 4 } }));
    expect(change).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'geometry.tools' })).toBeNull();
    expect(host.draggable).toHaveBeenLastCalledWith(false);
    act(() => host.events.error?.());
    expect(screen.getByText('messages.mapUnavailable')).toBeTruthy();
    unmount();
    expect(host.stopDraw).toHaveBeenCalledOnce();
    expect(host.removeMap).toHaveBeenCalledOnce();
    expect(geometryChange).not.toHaveBeenCalled();
  });
  it.each([
    { killSwitchEnabled: true, styleUrl: 'https://maps.test/style.json' },
    { killSwitchEnabled: false, styleUrl: '' },
  ])('keeps the manual fallback and does not create a disabled map', async (config) => {
    host.config.mockResolvedValue(config);
    render(
      <ConstructionSiteMap
        latitude={null}
        longitude={null}
        onChange={vi.fn()}
        onGeometryChange={vi.fn()}
      />
    );
    await screen.findByText('messages.mapUnavailable');
    expect(host.options).toBeUndefined();
    expect(screen.queryByRole('group', { name: 'geometry.tools' })).toBeNull();
  });
});
