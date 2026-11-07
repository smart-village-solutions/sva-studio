import { useEffect, useRef, useState } from 'react';
import { getHostMapGeocodingConfig, usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
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
  constructionSiteGeometrySchema,
  type ConstructionSiteGeometryV1,
} from './construction-sites.geometry.js';

type Props = Readonly<{
  latitude: number | null;
  longitude: number | null;
  geometry?: ConstructionSiteGeometryV1 | null;
  disabled?: boolean;
  onChange: (latitude: number, longitude: number) => void;
  onGeometryChange: (geometry: ConstructionSiteGeometryV1 | null) => void;
  onDrawingChange?: (drawing: boolean) => void;
  selectedFeatureId?: string;
  onSelectFeature?: (id: string) => void;
}>;
type Tool = 'select' | 'location' | 'linestring' | 'polygon';
let runtime: Promise<typeof import('maplibre-gl')> | undefined;
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
// Terra Draw accepts hex colors; resolve the existing semantic RGB tokens for its canvas.
const canvasColor = (token: string): `#${string}` => {
  const channels = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
    .split(/\s+/)
    .map(Number);
  return `#${channels
    .slice(0, 3)
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
};
const featureInput = (geometry: Props['geometry']) =>
  (geometry?.features ?? [])
    .filter(
      (feature) =>
        constructionSiteGeometrySchema.safeParse({
          version: 1,
          type: 'FeatureCollection',
          features: [feature],
        }).success
    )
    .map((f) => ({
      ...f,
      properties: { mode: f.geometry.type === 'Polygon' ? 'polygon' : 'linestring' },
    }));

export function ConstructionSiteMap(props: Props) {
  const pt = usePluginTranslation('construction-sites');
  const latest = useRef(props);
  latest.current = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markerRef = useRef<import('maplibre-gl').Marker | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const toolRef = useRef<Tool>('select');
  const suppress = useRef(false);
  const serialized = useRef('');
  const featureOrder = useRef<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [drawing, setDrawing] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [history, setHistory] = useState({ undo: false, redo: false });
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    let themeObserver: MutationObserver | undefined;
    void getHostMapGeocodingConfig()
      .then(async (config) => {
        if (config.killSwitchEnabled || !config.styleUrl) throw new Error('map_unavailable');
        const module = await load();
        if (!active || !container.current) return;
        const p = latest.current;
        const first = p.geometry?.features[0]?.geometry;
        const position =
          first?.type === 'Polygon' ? first.coordinates[0][0] : first?.coordinates[0];
        const map = new module.Map({
          container: container.current,
          style: config.styleUrl,
          center:
            p.longitude !== null && p.latitude !== null
              ? [p.longitude, p.latitude]
              : (position ?? [10.4, 51.16]),
          zoom: position || p.latitude !== null ? 14 : 6,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new module.AttributionControl({ compact: true }));
        const marker = new module.Marker({ draggable: false });
        markerRef.current = marker;
        const updatePoint = (latitude: number, longitude: number) => {
          if (!latest.current.disabled && toolRef.current === 'location')
            latest.current.onChange(
              Math.round(latitude * 1e6) / 1e6,
              Math.round(longitude * 1e6) / 1e6
            );
        };
        map.on('click', (event) => updatePoint(event.lngLat.lat, event.lngLat.lng));
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          updatePoint(p.lat, p.lng);
        });
        if (p.latitude !== null && p.longitude !== null)
          marker.setLngLat([p.longitude, p.latitude]).addTo(map);
        map.on('error', () => active && setError(true));
        map.on('load', () => {
          if (!active) return;
          const coordinates = (latest.current.geometry?.features ?? []).flatMap((feature) =>
            feature.geometry.type === 'Polygon'
              ? feature.geometry.coordinates[0]
              : feature.geometry.coordinates
          );
          if (coordinates.length) {
            const bounds = new module.LngLatBounds();
            for (const point of coordinates) bounds.extend(point);
            if (latest.current.latitude !== null && latest.current.longitude !== null)
              bounds.extend([latest.current.longitude, latest.current.latitude]);
            map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
          }
          const flags = {
            feature: {
              draggable: true,
              coordinates: { draggable: true, midpoints: true, deletable: true },
            },
          };
          const draw = new TerraDraw({
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
          drawRef.current = draw;
          draw.start();
          const applyStyles = () => {
            const primary = canvasColor('--primary');
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
          };
          applyStyles();
          themeObserver = new MutationObserver(applyStyles);
          themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'style', 'data-theme'],
          });
          draw.addFeatures(featureInput(latest.current.geometry));
          featureOrder.current = (latest.current.geometry?.features ?? []).map(
            (feature) => feature.id
          );
          serialized.current =
            latest.current.geometry &&
            !constructionSiteGeometrySchema.safeParse(latest.current.geometry).success
              ? ''
              : JSON.stringify(latest.current.geometry ?? null);
          draw.clearUndoRedoHistory();
          draw.setMode(latest.current.disabled ? 'render' : 'select');
          const sync = () => {
            if (!active || suppress.current) return;
            queueMicrotask(() => {
              if (!active || latest.current.disabled || suppress.current) return;
              // A partial coordinate form is authoritative until it becomes valid again.
              if (
                latest.current.geometry &&
                !constructionSiteGeometrySchema.safeParse(latest.current.geometry).success
              )
                return;
              const all = draw.getSnapshot();
              const incomplete =
                draw.getModeState() === 'drawing' ||
                all.some((f) => f.properties.currentlyDrawing === true);
              setDrawing(incomplete);
              latest.current.onDrawingChange?.(incomplete);
              setHistory({ undo: draw.canUndo(), redo: draw.canRedo() });
              if (incomplete) return;
              const features = all
                .filter((f) => f.geometry.type === 'LineString' || f.geometry.type === 'Polygon')
                .map((f) => ({ type: f.type, id: f.id, properties: {}, geometry: f.geometry }));
              // Terra Draw may remove/reinsert a feature during undo. Preserve the form's order.
              for (const feature of features) {
                if (!featureOrder.current.includes(String(feature.id)))
                  featureOrder.current.push(String(feature.id));
              }
              features.sort(
                (a, b) =>
                  featureOrder.current.indexOf(String(a.id)) -
                  featureOrder.current.indexOf(String(b.id))
              );
              const result = constructionSiteGeometrySchema.safeParse({
                version: 1,
                type: 'FeatureCollection',
                features,
              });
              if (features.length && !result.success) {
                setInvalid(true);
                latest.current.onDrawingChange?.(true);
                return;
              }
              setInvalid(false);
              const geometry = result.success ? result.data : null;
              const next = JSON.stringify(geometry);
              if (serialized.current !== next) {
                serialized.current = next;
                latest.current.onGeometryChange(geometry);
              }
            });
          };
          draw.on('change', sync);
          draw.on('finish', (id) => {
            queueMicrotask(() => {
              if (!active) return;
              draw.setMode('select');
              toolRef.current = 'select';
              setTool('select');
              latest.current.onSelectFeature?.(String(id));
              sync();
            });
          });
          draw.on('history', sync);
          draw.on('select', (id) => {
            setSelected(String(id));
            latest.current.onSelectFeature?.(String(id));
          });
          draw.on('deselect', () => setSelected(undefined));
          setReady(true);
        });
        dispose = () => {
          themeObserver?.disconnect();
          drawRef.current?.stop();
          drawRef.current = null;
          marker.remove();
          map.remove();
          mapRef.current = null;
          markerRef.current = null;
        };
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
      dispose?.();
      latest.current.onDrawingChange?.(false);
    };
  }, []);
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !ready) return;
    const next = JSON.stringify(props.geometry ?? null);
    if (next !== serialized.current) {
      // Invalid coordinate edits remain in the form; the map keeps its last valid snapshot.
      const parsed = constructionSiteGeometrySchema.safeParse(props.geometry);
      if (props.geometry && !parsed.success) {
        setInvalid(true);
        suppress.current = true;
        try {
          draw.setMode('render');
        } finally {
          suppress.current = false;
        }
        return;
      }
      suppress.current = true;
      try {
        const features = featureInput(props.geometry);
        for (const feature of features) {
          if (!featureOrder.current.includes(feature.id)) featureOrder.current.push(feature.id);
        }
        const ids = new Set(features.map((f) => f.id));
        const removed = draw
          .getSnapshot()
          .filter((f) => f.geometry.type === 'LineString' || f.geometry.type === 'Polygon')
          .filter((f) => !ids.has(String(f.id)))
          .map((f) => f.id!);
        if (removed.length) draw.removeFeatures(removed);
        for (const f of features) {
          const current = draw.getSnapshotFeature(f.id);
          if (!current) draw.addFeatures([f]);
          else if (JSON.stringify(current.geometry) !== JSON.stringify(f.geometry))
            draw.updateFeatureGeometry(f.id, f.geometry);
        }
        serialized.current = next;
        setInvalid(false);
      } finally {
        suppress.current = false;
        setHistory({ undo: draw.canUndo(), redo: draw.canRedo() });
      }
    }
    const mode = props.disabled
      ? 'render'
      : toolRef.current === 'location'
        ? 'render'
        : toolRef.current;
    if (draw.getMode() !== mode) draw.setMode(mode);
  }, [props.geometry, props.disabled, ready]);
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    marker.setDraggable(!props.disabled && tool === 'location');
    if (props.latitude !== null && props.longitude !== null)
      marker.setLngLat([props.longitude, props.latitude]).addTo(map);
    else marker.remove();
  }, [props.latitude, props.longitude, props.disabled, ready, tool]);
  useEffect(() => {
    const draw = drawRef.current;
    const id = props.selectedFeatureId;
    if (props.geometry && !constructionSiteGeometrySchema.safeParse(props.geometry).success) return;
    if (
      draw &&
      ready &&
      tool === 'select' &&
      !props.disabled &&
      id &&
      draw.getSnapshotFeature(id)
    ) {
      if (selected && selected !== id && draw.getSnapshotFeature(selected))
        draw.deselectFeature(selected);
      if (selected !== id) draw.selectFeature(id);
    }
  }, [props.selectedFeatureId, props.geometry, props.disabled, ready, tool, selected]);
  const switchTool = (next: Tool) => {
    toolRef.current = next;
    setTool(next);
    setDrawing(false);
    setSelected(undefined);
    props.onDrawingChange?.(false);
    drawRef.current?.setMode(next === 'location' ? 'render' : next);
  };
  const features = props.geometry?.features ?? [];
  const atLimit = features.length >= 10;
  const coordinateDraftInvalid =
    props.geometry != null && !constructionSiteGeometrySchema.safeParse(props.geometry).success;
  const remove = (id: string) => {
    const draw = drawRef.current;
    if (!coordinateDraftInvalid && draw?.getSnapshotFeature(id)) draw.removeFeatures([id]);
    else {
      const next = features.filter((feature) => feature.id !== id);
      props.onGeometryChange(
        next.length ? { version: 1, type: 'FeatureCollection', features: next } : null
      );
    }
    setSelected(undefined);
  };
  return (
    <div className="min-w-0 space-y-4">
      {!props.disabled && !error ? (
        <div
          className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
          role="group"
          aria-label={pt('geometry.tools')}
        >
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {(['select', 'location', 'linestring', 'polygon'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={tool === value ? 'primary' : 'secondary'}
                aria-pressed={tool === value}
                disabled={
                  !ready ||
                  coordinateDraftInvalid ||
                  (invalid && !drawing) ||
                  (drawing && tool !== value) ||
                  (atLimit && (value === 'linestring' || value === 'polygon'))
                }
                onClick={() => switchTool(value)}
              >
                {pt(`geometry.${value}`)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              variant="secondary"
              disabled={!ready || coordinateDraftInvalid || !history.undo}
              onClick={() => drawRef.current?.undo()}
            >
              {pt('geometry.undo')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!ready || coordinateDraftInvalid || !history.redo}
              onClick={() => drawRef.current?.redo()}
            >
              {pt('geometry.redo')}
            </Button>
          </div>
        </div>
      ) : null}
      {drawing || invalid ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
          <p role="status" className="text-sm">
            {pt(invalid ? 'geometry.invalid' : 'geometry.drawing')}
          </p>
          {!props.disabled && !coordinateDraftInvalid ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const draw = drawRef.current;
                if (!draw) return;
                suppress.current = true;
                try {
                  draw.setMode('select');
                  draw.clear();
                  draw.addFeatures(featureInput(props.geometry));
                } finally {
                  suppress.current = false;
                }
                setInvalid(false);
                switchTool('select');
              }}
            >
              {pt('geometry.cancelDrawing')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          {pt('messages.mapUnavailable')}
        </p>
      ) : null}
      <div className={error ? 'min-w-0' : 'grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]'}>
        <div
          className="relative min-w-0"
          hidden={error}
          role="region"
          aria-label={pt('geometry.map')}
        >
          <div
            ref={container}
            className="h-80 w-full overflow-hidden rounded-lg border border-border"
          />
          {ready ? (
            <div className="absolute bottom-3 left-3 flex gap-1">
              <Button
                type="button"
                variant="secondary"
                aria-label={pt('geometry.zoomIn')}
                onClick={() => mapRef.current?.zoomIn()}
              >
                +
              </Button>
              <Button
                type="button"
                variant="secondary"
                aria-label={pt('geometry.zoomOut')}
                onClick={() => mapRef.current?.zoomOut()}
              >
                −
              </Button>
            </div>
          ) : null}
        </div>
        <aside className="min-w-0 space-y-3" aria-label={pt('geometry.forms')}>
          <h3 className="font-semibold">{pt('geometry.formCount', { count: features.length })}</h3>
          <p className="text-xs text-muted-foreground">{pt('geometry.independent')}</p>
          {!features.length ? (
            <p className="text-sm text-muted-foreground">{pt('geometry.empty')}</p>
          ) : null}
          {features.map((feature, index) => {
            const active = props.selectedFeatureId === feature.id;
            const name = pt('geometry.feature', {
              kind: pt(feature.geometry.type === 'Polygon' ? 'geometry.area' : 'geometry.route'),
              position: index + 1,
            });
            const count =
              feature.geometry.type === 'Polygon'
                ? feature.geometry.coordinates[0].length - 1
                : feature.geometry.coordinates.length;
            return (
              <div
                key={feature.id}
                className={`space-y-2 rounded-lg border p-3 ${active ? 'border-primary bg-accent' : 'border-border bg-muted'}`}
              >
                <p className="text-sm font-medium">
                  {name} · {pt('geometry.pointCount', { count })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pt(
                    active
                      ? 'geometry.selectionHelp'
                      : feature.geometry.type === 'Polygon'
                        ? 'geometry.polygonHelp'
                        : 'geometry.lineHelp'
                  )}
                </p>
                {!props.disabled ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={drawing}
                      aria-pressed={active}
                      onClick={() => {
                        props.onSelectFeature?.(feature.id);
                        if (coordinateDraftInvalid) return;
                        switchTool('select');
                        if (drawRef.current?.getSnapshotFeature(feature.id))
                          drawRef.current.selectFeature(feature.id);
                      }}
                    >
                      {pt('geometry.selectFeature', { name })}
                    </Button>
                    {active ? (
                      <Button
                        type="button"
                        variant="tertiary"
                        disabled={drawing}
                        onClick={() => remove(feature.id)}
                      >
                        {pt('geometry.deleteSelected')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </aside>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {pt('geometry.limits', {
          count: features.reduce(
            (sum, feature) =>
              sum +
              (feature.geometry.type === 'Polygon'
                ? feature.geometry.coordinates[0].length
                : feature.geometry.coordinates.length),
            0
          ),
        })}
      </p>
      {atLimit ? (
        <p role="status" className="text-sm">
          {pt('geometry.formLimit')}
        </p>
      ) : null}
    </div>
  );
}
