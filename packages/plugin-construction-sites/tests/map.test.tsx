import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  config: vi.fn(),
  created: vi.fn(),
  options: undefined as undefined | { style: string; center: number[] },
  events: {} as Record<string, (event?: unknown) => void>,
  point: vi.fn(),
  draggable: vi.fn(),
  removeMap: vi.fn(),
  removeMarker: vi.fn(),
  stopDraw: vi.fn(),
  bounds: vi.fn(),
  styles: vi.fn(),
  update: vi.fn(),
  draw: undefined as unknown,
  drawEvents: {} as Record<string, (...args: unknown[]) => void>,
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
      if (options.center.some((n) => !Number.isFinite(n))) throw new Error('invalid_center');
      host.created();
      host.options = options;
    }
    addControl = vi.fn();
    fitBounds = vi.fn();
    zoomIn = vi.fn();
    zoomOut = vi.fn();
    on(name: string, listener: (event?: unknown) => void) {
      host.events[name] = listener;
    }
    remove = host.removeMap;
  },
  LngLatBounds: class {
    extend(point: number[]) {
      if (point.some((n) => !Number.isFinite(n))) throw new Error('invalid_bounds');
      host.bounds(point);
    }
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
// Stateful adapter contract; browser suite separately exercises real Terra Draw.
vi.mock('terra-draw-maplibre-gl-adapter', () => ({ TerraDrawMapLibreGLAdapter: class {} }));
vi.mock('terra-draw', async (original) => {
  const real = await original<typeof import('terra-draw')>();
  return {
    ...real,
    TerraDraw: class {
      mode = 'select';
      state = 'started';
      undoable = false;
      redoable = false;
      features: import('terra-draw').GeoJSONStoreFeatures[] = [];
      constructor() {
        host.draw = this;
      }
      start = vi.fn();
      stop = host.stopDraw;
      setModeStyles = host.styles;
      addFeatures(features: import('terra-draw').GeoJSONStoreFeatures[]) {
        for (const f of features) {
          if (
            f.geometry.type === 'LineString' &&
            f.geometry.coordinates.flat().some((n) => n !== Math.round(n * 1e6) / 1e6)
          )
            throw new Error('invalid_library_input');
        }
        this.features.push(...features);
      }
      clearUndoRedoHistory = vi.fn();
      setMode(mode: string) {
        this.mode = mode;
        this.state = 'started';
      }
      getMode() {
        return this.mode;
      }
      getModeState() {
        return this.state;
      }
      getSnapshot() {
        return this.features;
      }
      getSnapshotFeature(id: string) {
        return this.features.find((f) => f.id === id);
      }
      updateFeatureGeometry(
        id: string,
        geometry: import('terra-draw').GeoJSONStoreFeatures['geometry']
      ) {
        const feature = this.getSnapshotFeature(id)!;
        if (
          geometry.type === 'LineString' &&
          geometry.coordinates.flat().some((n) => n !== Math.round(n * 1e6) / 1e6)
        )
          throw new Error('invalid_library_input');
        host.update(id, geometry);
        feature.geometry = geometry;
      }
      removeFeatures(ids: string[]) {
        this.features = this.features.filter((f) => !ids.includes(String(f.id)));
      }
      clear() {
        this.features = [];
      }
      canUndo() {
        return this.undoable;
      }
      canRedo() {
        return this.redoable;
      }
      undo() {
        this.undoable = false;
        this.redoable = true;
        host.drawEvents.history?.();
      }
      redo() {
        this.undoable = true;
        this.redoable = false;
        host.drawEvents.history?.();
      }
      selectFeature(id: string) {
        host.drawEvents.select?.(id);
      }
      deselectFeature() {
        host.drawEvents.deselect?.();
      }
      on(name: string, listener: (...args: unknown[]) => void) {
        host.drawEvents[name] = listener;
      }
    },
  };
});
import { ConstructionSiteMap } from '../src/construction-sites.map.js';

beforeEach(() => {
  vi.clearAllMocks();
  host.options = undefined;
  host.events = {};
  host.drawEvents = {};
  host.draw = undefined;
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

type Geometry = import('../src/construction-sites.geometry.js').ConstructionSiteGeometryV1;
const line = (id = 'b4f97354-f138-459b-9c72-92d409cf2191'): Geometry['features'][number] => ({
  type: 'Feature',
  id,
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [13, 52],
      [13.1, 52.1],
    ],
  },
});
const geometry = (...features: Geometry['features']): Geometry => ({
  version: 1,
  type: 'FeatureCollection',
  features,
});
type MockDraw = {
  features: import('terra-draw').GeoJSONStoreFeatures[];
  mode: string;
  state: string;
  undoable: boolean;
  redoable: boolean;
};
const draw = () => host.draw as MockDraw;
const start = async () => {
  await waitFor(() => expect(host.events.load).toBeDefined());
  act(() => host.events.load());
};
const emit = async (name = 'change', ...args: unknown[]) => {
  await act(async () => {
    host.drawEvents[name]?.(...args);
    await Promise.resolve();
  });
};
const defaults = () => ({
  latitude: null,
  longitude: null,
  onChange: vi.fn(),
  onGeometryChange: vi.fn(),
  onDrawingChange: vi.fn(),
  onSelectFeature: vi.fn(),
});

describe('map draft boundary', () => {
  beforeEach(() => host.config.mockResolvedValue({ styleUrl: 'style.json' }));
  it('keeps partial coordinates out of both delayed initialization stages', async () => {
    let resolve!: (config: object) => void;
    host.config.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const props = defaults();
    const view = render(<ConstructionSiteMap {...props} />);
    const partial = line();
    partial.geometry.coordinates = [
      [Number.NaN, Number.NaN],
      [13, 52],
    ];
    view.rerender(<ConstructionSiteMap {...props} geometry={geometry(partial)} />);
    await act(async () => {
      resolve({ styleUrl: 'style.json' });
    });
    await start();
    expect(host.options?.center).toEqual([10.4, 51.16]);
    expect(host.bounds).not.toHaveBeenCalled();
    expect(draw().mode).toBe('render');
    expect(props.onGeometryChange).not.toHaveBeenCalled();
  });
  it('normalizes initial and updated coordinates before the drawing library sees them', async () => {
    const props = defaults();
    const feature = line();
    feature.geometry.coordinates[0] = [13.123456789, 52];
    const view = render(<ConstructionSiteMap {...props} geometry={geometry(feature)} />);
    await start();
    expect(draw().features[0]?.geometry.coordinates[0]).toEqual([13.123457, 52]);
    feature.geometry.coordinates[0] = [13.234567891, 52];
    view.rerender(<ConstructionSiteMap {...props} geometry={geometry(feature)} />);
    expect(host.update).toHaveBeenCalledWith(
      feature.id,
      expect.objectContaining({
        coordinates: [
          [13.234568, 52],
          [13.1, 52.1],
        ],
      })
    );
  });
  it('also protects bounds when the draft becomes incomplete after map creation', async () => {
    const props = defaults();
    const view = render(<ConstructionSiteMap {...props} />);
    await waitFor(() => expect(host.events.load).toBeDefined());
    const partial = line();
    partial.geometry.coordinates[0] = [Number.NaN, 52];
    view.rerender(<ConstructionSiteMap {...props} geometry={geometry(partial)} />);
    act(() => host.events.load());
    expect(host.bounds).not.toHaveBeenCalled();
    expect(draw().mode).toBe('render');
  });
});

const guidance = (): import('terra-draw').GeoJSONStoreFeatures => ({
  type: 'Feature',
  id: 'guidance',
  properties: { mode: 'select' },
  geometry: { type: 'Point', coordinates: [13, 52] },
});
describe('drawing and form synchronization', () => {
  beforeEach(() => host.config.mockResolvedValue({ styleUrl: 'style.json' }));
  it('ignores unfinished drawings, cancels to the form, strips helper metadata and deduplicates changes', async () => {
    const props = defaults();
    render(<ConstructionSiteMap {...props} />);
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'geometry.linestring' }));
    draw().state = 'drawing';
    draw().features = [
      { ...line(), properties: { mode: 'linestring', currentlyDrawing: true } },
      guidance(),
    ];
    await emit();
    expect(props.onDrawingChange).toHaveBeenLastCalledWith(true);
    expect(props.onGeometryChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'geometry.cancelDrawing' }));
    expect(draw().features).toEqual([]);
    draw().features = [
      { ...line(), properties: { mode: 'linestring', selected: true } },
      guidance(),
    ];
    draw().undoable = true;
    await emit('finish', line().id);
    expect(draw().mode).toBe('select');
    expect(props.onSelectFeature).toHaveBeenCalledWith(line().id);
    expect(props.onGeometryChange).toHaveBeenLastCalledWith(geometry(line()));
    await emit();
    expect(props.onGeometryChange).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'geometry.undo' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      (screen.getByRole('button', { name: 'geometry.redo' }) as HTMLButtonElement).disabled
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'geometry.redo' }));
    await emit();
    expect(
      (screen.getByRole('button', { name: 'geometry.undo' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
  it('preserves form order through native undo reinsertion and rejects invalid native geometries', async () => {
    const props = defaults();
    const a = line(),
      b = line('f87b012f-30e7-4e34-a0fe-26f42bfb397f');
    render(<ConstructionSiteMap {...props} geometry={geometry(a, b)} />);
    await start();
    draw().features.reverse();
    await emit();
    expect(props.onGeometryChange).not.toHaveBeenCalled();
    draw().features = [line()];
    draw().features[0]!.geometry = {
      type: 'LineString',
      coordinates: [
        [13, 52],
        [13, 52],
      ],
    };
    await emit();
    expect(props.onDrawingChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('geometry.invalid')).toBeTruthy();
    expect(props.onGeometryChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'geometry.cancelDrawing' }));
    expect(draw().features).toHaveLength(2);
    expect(props.onDrawingChange).toHaveBeenLastCalledWith(false);
  });
  it('reconciles external forms without deleting guidance, links selection and removes the native feature', async () => {
    const props = defaults();
    const a = line(),
      b = line('f87b012f-30e7-4e34-a0fe-26f42bfb397f');
    const view = render(
      <ConstructionSiteMap {...props} geometry={geometry(a, b)} selectedFeatureId={a.id} />
    );
    await start();
    expect(props.onSelectFeature).toHaveBeenCalledWith(a.id);
    draw().features.push(guidance());
    const c = line('76539bb2-10cb-42cf-8db0-432b9812f671');
    const updated = line();
    updated.geometry.coordinates[1] = [14, 53];
    view.rerender(
      <ConstructionSiteMap {...props} geometry={geometry(updated, c)} selectedFeatureId={c.id} />
    );
    expect(draw().features.map((f) => f.id)).toEqual([a.id, 'guidance', c.id]);
    expect(props.onSelectFeature).toHaveBeenLastCalledWith(c.id);
    fireEvent.click(screen.getByRole('button', { name: 'geometry.selectFeature', pressed: false }));
    expect(draw().mode).toBe('select');
    fireEvent.click(screen.getByRole('button', { name: 'geometry.deleteSelected' }));
    await emit();
    expect(props.onGeometryChange).toHaveBeenCalled();
    view.rerender(<ConstructionSiteMap {...props} geometry={null} />);
    expect(draw().features).toEqual([guidance()]);
    await emit();
    // An external clear is already acknowledged; the map must not echo a redundant write.
    expect(props.onGeometryChange).toHaveBeenCalledTimes(1);
  });
  it('protects incomplete coordinate edits from native changes and deletes from the full form draft', async () => {
    const props = defaults();
    const a = line();
    const view = render(
      <ConstructionSiteMap {...props} geometry={geometry(a)} selectedFeatureId={a.id} />
    );
    await start();
    const partial = line();
    partial.geometry.coordinates[0] = [Number.NaN, 52];
    view.rerender(
      <ConstructionSiteMap {...props} geometry={geometry(partial)} selectedFeatureId={a.id} />
    );
    expect(draw().mode).toBe('render');
    await emit();
    expect(props.onGeometryChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'geometry.selectFeature' }));
    expect(draw().mode).toBe('render');
    fireEvent.click(screen.getByRole('button', { name: 'geometry.deleteSelected' }));
    expect(props.onGeometryChange).toHaveBeenLastCalledWith(null);
    view.rerender(
      <ConstructionSiteMap {...props} geometry={geometry(a)} selectedFeatureId={a.id} />
    );
    expect(draw().mode).toBe('select');
    expect(draw().features[0]?.geometry.coordinates[0]).toEqual([13, 52]);
  });
  it('renders stored polygon and location in readonly mode without accepting queued native writes', async () => {
    const props = defaults();
    const area = line();
    area.geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [13, 52],
          [14, 52],
          [14, 53],
          [13, 52],
        ],
      ],
    };
    const view = render(
      <ConstructionSiteMap
        {...props}
        latitude={0}
        longitude={0}
        geometry={geometry(area)}
        disabled
      />
    );
    await start();
    expect(draw().features[0]?.geometry.type).toBe('Polygon');
    expect(draw().mode).toBe('render');
    expect(host.bounds).toHaveBeenCalledWith([0, 0]);
    await emit();
    expect(props.onGeometryChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'geometry.selectFeature' })).toBeNull();
    view.unmount();
    await emit('finish', area.id);
    expect(props.onGeometryChange).not.toHaveBeenCalled();
  });
  it('keeps dark-mode contours above 3:1 on the independent light basemap and observes theme changes', async () => {
    document.documentElement.style.setProperty('--primary', '117 192 245');
    document.documentElement.style.setProperty('--background', '17 24 32');
    render(<ConstructionSiteMap {...defaults()} />);
    await start();
    const color = host.styles.mock.calls.find((c) => c[0] === 'linestring')![1]
      .lineStringColor as string;
    const channels = color
      .slice(1)
      .match(/../g)!
      .map((s) => parseInt(s, 16) / 255);
    const lum = channels.reduce(
      (sum, c, i) =>
        sum +
        (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!,
      0
    );
    expect((0.85499 + 0.05) / (lum + 0.05)).toBeGreaterThan(3);
    const before = host.styles.mock.calls.length;
    await act(async () => {
      document.documentElement.classList.toggle('dark');
      await Promise.resolve();
    });
    expect(host.styles.mock.calls.length).toBeGreaterThan(before);
    fireEvent.click(screen.getByRole('button', { name: 'geometry.zoomIn' }));
    fireEvent.click(screen.getByRole('button', { name: 'geometry.zoomOut' }));
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--background');
  });
  it('does not initialize after unmount while configuration is pending', async () => {
    let resolve!: (config: object) => void;
    host.config.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const view = render(<ConstructionSiteMap {...defaults()} />);
    view.unmount();
    await act(async () => {
      resolve({ styleUrl: 'style.json' });
    });
    expect(host.options).toBeUndefined();
  });
});

it('does not revive the first asynchronous initialization after a StrictMode remount', async () => {
  const resolvers: ((config: object) => void)[] = [];
  host.config.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
  render(
    <React.StrictMode>
      <ConstructionSiteMap {...defaults()} />
    </React.StrictMode>
  );
  await act(async () => {
    for (const resolve of resolvers) resolve({ styleUrl: 'style.json' });
  });
  await start();
  expect(host.created).toHaveBeenCalledOnce();
});
