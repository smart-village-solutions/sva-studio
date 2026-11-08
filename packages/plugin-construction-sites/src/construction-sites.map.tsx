import { useEffect, useRef, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import {
  ConstructionSiteDrawing,
  invalidDraft,
  type MapProps,
  type MapStatus,
} from './construction-sites.map-drawing.js';
import { ConstructionSiteMapRuntime } from './construction-sites.map-runtime.js';
import { MapTools, MapShapes } from './construction-sites.map-controls.js';
function useMap(props: MapProps) {
  const [state, setState] = useState<MapStatus>({
    ready: false,
    error: false,
    invalid: false,
    drawing: false,
    tool: 'select',
    undo: false,
    redo: false,
  });
  const [controller] = useState(
    () => new ConstructionSiteDrawing(props, (patch) => setState((s) => ({ ...s, ...patch })))
  );
  controller.props = props;
  const [map] = useState(
    () => new ConstructionSiteMapRuntime(controller, () => setState((s) => ({ ...s, error: true })))
  );
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current) return map.mount(container.current);
  }, [map]);
  useEffect(() => {
    controller.reconcile();
  }, [controller, props.geometry, props.disabled, state.ready]);
  useEffect(() => {
    map.updateMarker();
  }, [map, props.latitude, props.longitude, props.disabled, state.ready, state.tool]);
  useEffect(() => {
    controller.select(props.selectedFeatureId);
  }, [
    controller,
    props.selectedFeatureId,
    props.geometry,
    props.disabled,
    state.ready,
    state.tool,
    state.selected,
  ]);
  return { state, controller, map, container };
}
export function ConstructionSiteMap(props: MapProps) {
  const pt = usePluginTranslation('construction-sites');
  const { state, controller, map, container } = useMap(props);
  const { error, ready } = state;
  const features = props.geometry?.features ?? [];
  const atLimit = features.length >= 10;
  return (
    <div className="min-w-0 space-y-4">
      <MapTools props={props} controller={controller} state={state} />
      <MapDraftStatus props={props} controller={controller} state={state} />
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
          aria-busy={!ready}
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
                onClick={() => map.map?.zoomIn()}
              >
                +
              </Button>
              <Button
                type="button"
                variant="secondary"
                aria-label={pt('geometry.zoomOut')}
                onClick={() => map.map?.zoomOut()}
              >
                −
              </Button>
            </div>
          ) : null}
        </div>
        <MapShapes props={props} controller={controller} state={state} />
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

function MapDraftStatus({
  props,
  controller,
  state,
}: {
  props: MapProps;
  controller: ConstructionSiteDrawing;
  state: MapStatus;
}) {
  const pt = usePluginTranslation('construction-sites');
  const { drawing, invalid } = state;
  const coordinateDraftInvalid = invalidDraft(props.geometry);
  return (
    <>
      {drawing || invalid ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
          <p role="status" className="text-sm">
            {pt(invalid ? 'geometry.invalid' : 'geometry.drawing')}
          </p>
          {!props.disabled && !coordinateDraftInvalid ? (
            <Button type="button" variant="secondary" onClick={() => controller.cancel()}>
              {pt('geometry.cancelDrawing')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
