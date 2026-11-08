import type { TerraDraw } from 'terra-draw';
import {
  constructionSiteGeometrySchema,
  type ConstructionSiteGeometryV1,
} from './construction-sites.geometry.js';
export type MapProps = Readonly<{
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
export type MapTool = 'select' | 'location' | 'linestring' | 'polygon';
export type MapStatus = {
  ready: boolean;
  error: boolean;
  invalid: boolean;
  drawing: boolean;
  tool: MapTool;
  selected?: string;
  undo: boolean;
  redo: boolean;
};
export const featureInput = (geometry: MapProps['geometry']) =>
  (geometry?.features ?? []).flatMap((feature) => {
    const parsed = constructionSiteGeometrySchema.safeParse({
      version: 1,
      type: 'FeatureCollection',
      features: [feature],
    });
    return parsed.success
      ? parsed.data.features.map((f) => ({
          ...f,
          properties: { mode: f.geometry.type === 'Polygon' ? 'polygon' : 'linestring' },
        }))
      : [];
  });
export const invalidDraft = (geometry: MapProps['geometry']) =>
  geometry != null && !constructionSiteGeometrySchema.safeParse(geometry).success;

/** Owns only the existing editor's native drawing snapshot and its form reconciliation. */
export class ConstructionSiteDrawing {
  native: TerraDraw | null = null;
  tool: MapTool = 'select';
  private active = true;
  private suppress = false;
  private serialized = '';
  private order: string[] = [];
  private selected?: string;
  constructor(
    public props: MapProps,
    private notify: (patch: Partial<MapStatus>) => void
  ) {}
  start(draw: TerraDraw) {
    this.active = true;
    this.native = draw;
    draw.start();
    draw.addFeatures(featureInput(this.props.geometry));
    this.order = (this.props.geometry?.features ?? []).map((f) => f.id);
    this.serialized = invalidDraft(this.props.geometry)
      ? ''
      : JSON.stringify(this.props.geometry ?? null);
    draw.clearUndoRedoHistory();
    draw.setMode(this.props.disabled || invalidDraft(this.props.geometry) ? 'render' : 'select');
    draw.on('change', this.sync);
    draw.on('history', this.sync);
    draw.on('finish', (id) =>
      queueMicrotask(() => {
        if (!this.active) return;
        this.switchTool('select');
        this.props.onSelectFeature?.(String(id));
        this.sync();
      })
    );
    draw.on('select', (id) => {
      this.selected = String(id);
      this.notify({ selected: this.selected });
      this.props.onSelectFeature?.(this.selected);
    });
    draw.on('deselect', () => {
      this.selected = undefined;
      this.notify({ selected: undefined });
    });
    this.notify({ ready: true, invalid: invalidDraft(this.props.geometry) });
  }
  stop() {
    this.active = false;
    this.native?.stop();
    this.native = null;
    this.props.onDrawingChange?.(false);
  }
  private history() {
    this.notify({ undo: this.native!.canUndo(), redo: this.native!.canRedo() });
  }
  private sync = () => {
    if (!this.active || this.suppress) return;
    queueMicrotask(() => this.syncSnapshot());
  };
  private syncSnapshot() {
    const draw = this.native;
    if (
      !this.active ||
      !draw ||
      this.props.disabled ||
      this.suppress ||
      invalidDraft(this.props.geometry)
    )
      return;
    const all = draw.getSnapshot();
    const drawing =
      draw.getModeState() === 'drawing' || all.some((f) => f.properties.currentlyDrawing === true);
    this.notify({ drawing });
    this.props.onDrawingChange?.(drawing);
    this.history();
    if (drawing) return;
    const features = all
      .filter((f) => f.geometry.type === 'LineString' || f.geometry.type === 'Polygon')
      .map((f) => ({ type: f.type, id: f.id, properties: {}, geometry: f.geometry }));
    for (const feature of features)
      if (!this.order.includes(String(feature.id))) this.order.push(String(feature.id));
    features.sort((a, b) => this.order.indexOf(String(a.id)) - this.order.indexOf(String(b.id)));
    const parsed = constructionSiteGeometrySchema.safeParse({
      version: 1,
      type: 'FeatureCollection',
      features,
    });
    if (features.length && !parsed.success) {
      this.notify({ invalid: true });
      this.props.onDrawingChange?.(true);
      return;
    }
    this.notify({ invalid: false });
    const geometry = parsed.success ? parsed.data : null;
    const next = JSON.stringify(geometry);
    if (this.serialized !== next) {
      this.serialized = next;
      this.props.onGeometryChange(geometry);
    }
  }
  reconcile() {
    const draw = this.native;
    if (!draw) return;
    if (invalidDraft(this.props.geometry)) {
      this.notify({ invalid: true });
      this.suppress = true;
      try {
        draw.setMode('render');
      } finally {
        this.suppress = false;
      }
      return;
    }
    const next = JSON.stringify(this.props.geometry ?? null);
    if (next !== this.serialized) {
      this.suppress = true;
      try {
        this.replaceFeatures();
        this.serialized = next;
        this.notify({ invalid: false });
      } finally {
        this.suppress = false;
        this.history();
      }
    }
    const mode = this.props.disabled || this.tool === 'location' ? 'render' : this.tool;
    if (draw.getMode() !== mode) draw.setMode(mode);
  }
  private replaceFeatures() {
    const draw = this.native!;
    const features = featureInput(this.props.geometry);
    for (const feature of features)
      if (!this.order.includes(feature.id)) this.order.push(feature.id);
    const ids = new Set(features.map((f) => f.id));
    // Guidance points belong to Terra Draw, never to the persisted form.
    const removed = draw
      .getSnapshot()
      .filter((f) => f.geometry.type === 'LineString' || f.geometry.type === 'Polygon')
      .filter((f) => !ids.has(String(f.id)))
      .map((f) => f.id!);
    if (removed.length) draw.removeFeatures(removed);
    for (const feature of features) {
      const current = draw.getSnapshotFeature(feature.id);
      if (!current) draw.addFeatures([feature]);
      else if (JSON.stringify(current.geometry) !== JSON.stringify(feature.geometry))
        draw.updateFeatureGeometry(feature.id, feature.geometry);
    }
  }
  select(id?: string) {
    const draw = this.native;
    if (
      !draw ||
      this.tool !== 'select' ||
      this.props.disabled ||
      !id ||
      invalidDraft(this.props.geometry) ||
      !draw.getSnapshotFeature(id)
    )
      return;
    if (this.selected && this.selected !== id && draw.getSnapshotFeature(this.selected))
      draw.deselectFeature(this.selected);
    if (this.selected !== id) draw.selectFeature(id);
  }
  choose(id: string) {
    this.props.onSelectFeature?.(id);
    if (invalidDraft(this.props.geometry)) return;
    this.switchTool('select');
    this.select(id);
  }
  switchTool(next: MapTool) {
    this.tool = next;
    this.selected = undefined;
    this.notify({ tool: next, drawing: false, selected: undefined });
    this.props.onDrawingChange?.(false);
    this.native?.setMode(next === 'location' ? 'render' : next);
  }
  remove(id: string) {
    if (!invalidDraft(this.props.geometry) && this.native?.getSnapshotFeature(id))
      this.native.removeFeatures([id]);
    else {
      const features = (this.props.geometry?.features ?? []).filter((f) => f.id !== id);
      this.props.onGeometryChange(
        features.length ? { version: 1, type: 'FeatureCollection', features } : null
      );
    }
    this.selected = undefined;
    this.notify({ selected: undefined });
  }
  cancel() {
    if (!this.native) return;
    this.suppress = true;
    try {
      this.native.setMode('select');
      this.native.clear();
      this.native.addFeatures(featureInput(this.props.geometry));
    } finally {
      this.suppress = false;
    }
    this.notify({ invalid: false });
    this.switchTool('select');
  }
}
