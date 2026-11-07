import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import {
  invalidDraft,
  type ConstructionSiteDrawing,
  type MapProps,
  type MapStatus,
} from './construction-sites.map-drawing.js';
import type { ConstructionSiteGeometryFeature } from './construction-sites.geometry.js';
type Controls = { props: MapProps; controller: ConstructionSiteDrawing; state: MapStatus };
export function MapTools({ props, controller, state }: Controls) {
  const pt = usePluginTranslation('construction-sites');
  const { tool, ready, error } = state;
  const history = state;
  const features = props.geometry?.features ?? [];
  const coordinateDraftInvalid = invalidDraft(props.geometry);
  const atLimit = features.length >= 10;
  return (
    <>
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
                disabled={toolDisabled(value, state, coordinateDraftInvalid, atLimit)}
                onClick={() => controller.switchTool(value)}
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
              onClick={() => controller.native?.undo()}
            >
              {pt('geometry.undo')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!ready || coordinateDraftInvalid || !history.redo}
              onClick={() => controller.native?.redo()}
            >
              {pt('geometry.redo')}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
export function MapShapes({ props, controller, state }: Controls) {
  const pt = usePluginTranslation('construction-sites');
  const features = props.geometry?.features ?? [];
  return (
    <aside className="min-w-0 space-y-3" aria-label={pt('geometry.forms')}>
      <h3 className="font-semibold">{pt('geometry.formCount', { count: features.length })}</h3>
      <p className="text-xs text-muted-foreground">{pt('geometry.independent')}</p>
      {!features.length ? (
        <p className="text-sm text-muted-foreground">{pt('geometry.empty')}</p>
      ) : null}
      {features.map((feature, index) => (
        <Shape
          key={feature.id}
          feature={feature}
          index={index}
          props={props}
          controller={controller}
          state={state}
        />
      ))}
    </aside>
  );
}
function Shape({
  props,
  controller,
  state,
  feature,
  index,
}: Controls & { feature: ConstructionSiteGeometryFeature; index: number }) {
  const pt = usePluginTranslation('construction-sites');
  const { drawing } = state;

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
              controller.choose(feature.id);
            }}
          >
            {pt('geometry.selectFeature', { name })}
          </Button>
          {active ? (
            <Button
              type="button"
              variant="tertiary"
              disabled={drawing}
              onClick={() => controller.remove(feature.id)}
            >
              {pt('geometry.deleteSelected')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function toolDisabled(
  value: string,
  state: MapStatus,
  coordinateDraftInvalid: boolean,
  atLimit: boolean
) {
  return (
    !state.ready ||
    coordinateDraftInvalid ||
    (state.invalid && !state.drawing) ||
    (state.drawing && state.tool !== value) ||
    (atLimit && (value === 'linestring' || value === 'polygon'))
  );
}
