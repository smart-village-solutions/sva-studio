import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawRenderMode,
  TerraDrawModeUndoRedo,
  TerraDrawSessionUndoRedo,
  ValidateNotSelfIntersecting,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  ConstructionSiteDrawing,
  featureInput,
  type MapProps,
} from './construction-sites.map-drawing.js';
type MapModule = typeof import('maplibre-gl');
let runtime: Promise<MapModule> | undefined;
const load = () =>
  (runtime ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
  ])
    .then(([module, , worker]) => {
      module.setWorkerUrl(worker.default);
      return module;
    })
    .catch((error: unknown) => {
      runtime = undefined;
      throw error;
    }));

const luminance = (channels: number[]) =>
  channels.reduce((sum, n, i) => {
    const s = n / 255;
    return (
      sum + (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!
    );
  }, 0);
// Map tiles have their own theme. Keep the semantic hue but cap brightness for legible contours on light tiles.
const canvasColor = (token: string, contour = false): `#${string}` => {
  let channels = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
    .split(/\s+/)
    .map(Number)
    .slice(0, 3);
  if (channels.length !== 3 || channels.some((n) => !Number.isFinite(n))) channels = [0, 90, 158];
  while (contour && luminance(channels) > 0.12) channels = channels.map((n) => Math.round(n * 0.9));
  return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
};
function applyStyles(draw: TerraDraw) {
  const primary = canvasColor('--primary', true);
  const background = canvasColor('--background');
  draw.setModeStyles('linestring', {
    lineStringColor: primary,
    lineStringWidth: 4,
    coordinatePointColor: background,
    coordinatePointOutlineColor: primary,
  });
  draw.setModeStyles('polygon', {
    fillColor: primary,
    fillOpacity: 0.16,
    outlineColor: primary,
    outlineWidth: 2,
  });
  draw.setModeStyles('select', {
    selectedLineStringColor: primary,
    selectedLineStringWidth: 4,
    selectedPolygonColor: primary,
    selectedPolygonOutlineColor: primary,
    selectionPointColor: background,
    selectionPointOutlineColor: primary,
    midPointColor: background,
    midPointOutlineColor: primary,
  });
  draw.setModeStyles('render', {
    lineStringColor: primary,
    polygonFillColor: primary,
    polygonOutlineColor: primary,
  });
}
function createDrawing(map: import('maplibre-gl').Map) {
  const flags = {
    feature: {
      draggable: true,
      coordinates: { draggable: true, midpoints: true, deletable: true },
    },
  };
  return new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 6 }),
    modes: [
      new TerraDrawLineStringMode(),
      new TerraDrawPolygonMode({
        validation: (f, { updateType }) =>
          updateType === 'finish' || updateType === 'commit'
            ? ValidateNotSelfIntersecting(f)
            : { valid: true },
      }),
      new TerraDrawSelectMode({ flags: { linestring: flags, polygon: flags } }),
      new TerraDrawRenderMode({ modeName: 'render', styles: {} }),
    ],
    undoRedo: {
      modeLevel: new TerraDrawModeUndoRedo(),
      sessionLevel: new TerraDrawSessionUndoRedo(),
    },
  });
}
const point = (props: MapProps): [number, number] | undefined => {
  const { latitude, longitude } = props;
  return latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? [longitude, latitude]
    : undefined;
};
const coordinates = (props: MapProps) =>
  featureInput(props.geometry).flatMap((f) =>
    f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates
  );

/** Single MapLibre lifecycle for the existing editor; coordinates never bypass the draft validator. */
export class ConstructionSiteMapRuntime {
  map: import('maplibre-gl').Map | null = null;
  marker: import('maplibre-gl').Marker | null = null;
  private active = true;
  private generation = 0;
  private themeObserver?: MutationObserver;
  constructor(
    private drawing: ConstructionSiteDrawing,
    private onError: () => void
  ) {}
  mount(container: HTMLElement) {
    this.active = true;
    const generation = ++this.generation;
    void getHostMapGeocodingConfig()
      .then(async (config) => {
        if (config.killSwitchEnabled || !config.styleUrl) throw new Error('map_unavailable');
        const module = await load();
        if (!this.active || generation !== this.generation) return;
        this.createMap(module, container, config.styleUrl);
      })
      .catch(() => {
        if (this.active && generation === this.generation) this.onError();
      });
    return () => this.dispose();
  }
  private createMap(module: MapModule, container: HTMLElement, style: string) {
    const props = this.drawing.props;
    const center = point(props) ?? coordinates(props)[0];
    const map = new module.Map({
      container,
      style,
      center: center ?? [10.4, 51.16],
      zoom: center ? 14 : 6,
      attributionControl: false,
    });
    this.map = map;
    map.addControl(new module.AttributionControl({ compact: true }));
    const marker = new module.Marker({ draggable: false });
    this.marker = marker;
    this.updateMarker();
    map.on('click', (event) => this.updatePoint(event.lngLat.lat, event.lngLat.lng));
    marker.on('dragend', () => {
      const p = marker.getLngLat();
      this.updatePoint(p.lat, p.lng);
    });
    map.on('error', () => {
      if (this.active) this.onError();
    });
    map.on('load', () => {
      if (!this.active || this.map !== map) return;
      try {
        this.startDrawing(module, map);
      } catch {
        this.onError();
      }
    });
  }
  private startDrawing(module: MapModule, map: import('maplibre-gl').Map) {
    const positions = coordinates(this.drawing.props);
    if (positions.length) {
      const bounds = new module.LngLatBounds();
      for (const position of positions) bounds.extend(position);
      const location = point(this.drawing.props);
      if (location) bounds.extend(location);
      map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
    }
    const draw = createDrawing(map);
    this.drawing.start(draw);
    applyStyles(draw);
    this.themeObserver = new MutationObserver(() => applyStyles(draw));
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-theme-mode'],
    });
  }
  private updatePoint(latitude: number, longitude: number) {
    if (!this.drawing.props.disabled && this.drawing.tool === 'location')
      this.drawing.props.onChange(
        Math.round(latitude * 1e6) / 1e6,
        Math.round(longitude * 1e6) / 1e6
      );
  }
  updateMarker() {
    const { marker, map } = this;
    if (!marker || !map) return;
    marker.setDraggable(!this.drawing.props.disabled && this.drawing.tool === 'location');
    const location = point(this.drawing.props);
    if (location) marker.setLngLat(location).addTo(map);
    else marker.remove();
  }
  private dispose() {
    this.active = false;
    this.themeObserver?.disconnect();
    this.drawing.stop();
    this.marker?.remove();
    this.map?.remove();
    this.marker = null;
    this.map = null;
  }
}
