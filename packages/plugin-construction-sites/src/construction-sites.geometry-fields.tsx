import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField } from '@sva/studio-ui-react';
import type { ConstructionSiteFormProps } from './construction-sites.form.js';
import type {
  ConstructionSiteGeometryFeature,
  ConstructionSiteGeometryV1,
} from './construction-sites.geometry.js';

export function ConstructionSiteGeometryFields({
  draft,
  change,
  disabled,
  errors,
  selectedFeatureId,
  onSelectFeature,
}: ConstructionSiteFormProps &
  Readonly<{ selectedFeatureId?: string; onSelectFeature?: (id: string) => void }>) {
  const pt = usePluginTranslation('construction-sites');
  const features = draft.geometry?.features ?? [];
  const commit = (next: ConstructionSiteGeometryV1['features']) =>
    change(
      'geometry',
      next.length ? { version: 1, type: 'FeatureCollection', features: next } : null
    );
  const update = (feature: ConstructionSiteGeometryFeature, points: [number, number][]) =>
    commit(
      features.map((f) =>
        f.id === feature.id
          ? {
              ...f,
              geometry:
                feature.geometry.type === 'Polygon'
                  ? { type: 'Polygon', coordinates: [[...points, points[0]!]] }
                  : { type: 'LineString', coordinates: points },
            }
          : f
      )
    );
  const add = (type: 'LineString' | 'Polygon') => {
    const points: [number, number][] = Array.from({ length: type === 'Polygon' ? 3 : 2 }, () => [
      Number.NaN,
      Number.NaN,
    ]);
    const id = crypto.randomUUID();
    onSelectFeature?.(id);
    commit([
      ...features,
      {
        type: 'Feature',
        id,
        properties: {},
        geometry:
          type === 'Polygon'
            ? { type, coordinates: [[...points, points[0]!]] }
            : { type, coordinates: points },
      },
    ]);
  };
  const totalPositions = features.reduce(
    (sum, f) =>
      sum +
      (f.geometry.type === 'Polygon'
        ? f.geometry.coordinates[0].length
        : f.geometry.coordinates.length),
    0
  );
  const hasErrors = errors.some((error) => error.startsWith('geometry'));
  return (
    <div id="cs-geometry" tabIndex={-1} className="space-y-4">
      {hasErrors ? (
        <p role="alert" className="text-sm text-destructive">
          {pt('geometry.invalid')}
        </p>
      ) : null}
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || features.length >= 10}
            onClick={() => add('LineString')}
          >
            {pt('geometry.addLineCoordinates')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || features.length >= 10}
            onClick={() => add('Polygon')}
          >
            {pt('geometry.addPolygonCoordinates')}
          </Button>
        </div>
      ) : null}
      {features.map((feature, fi) => {
        const points =
          feature.geometry.type === 'Polygon'
            ? feature.geometry.coordinates[0].slice(0, -1)
            : feature.geometry.coordinates;
        const name = pt('geometry.feature', {
          kind: pt(feature.geometry.type === 'Polygon' ? 'geometry.area' : 'geometry.route'),
          position: fi + 1,
        });
        return (
          <details
            key={feature.id}
            open={hasErrors || !selectedFeatureId || selectedFeatureId === feature.id}
            onToggle={(event) => {
              if (event.currentTarget.open) onSelectFeature?.(feature.id);
            }}
            className="min-w-0 rounded-lg border border-border"
          >
            <summary className="cursor-pointer p-3 text-sm font-medium">
              {pt('geometry.coordinatesFor', { name })}
            </summary>
            <p className="px-4 text-xs text-muted-foreground">{pt('geometry.coordinateHelp')}</p>
            <fieldset key={feature.id} disabled={disabled} className="min-w-0 space-y-3 p-4">
              <legend className="sr-only">
                {pt('geometry.feature', {
                  kind: pt(
                    feature.geometry.type === 'Polygon' ? 'geometry.area' : 'geometry.route'
                  ),
                  position: fi + 1,
                })}
              </legend>
              {points.map((point, pi) => (
                <div key={pi} className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-end">
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                    {(['latitude', 'longitude'] as const).map((axis) => {
                      const ai = axis === 'longitude' ? 0 : 1;
                      const id = `cs-geometry-${feature.id}-${pi}-${axis}`;
                      return (
                        <StudioField
                          key={axis}
                          id={id}
                          label={pt('geometry.coordinate', {
                            position: pi + 1,
                            axis: pt(`fields.${axis}`),
                          })}
                        >
                          <Input
                            id={id}
                            type="number"
                            step="any"
                            inputMode="decimal"
                            min={axis === 'latitude' ? -90 : -180}
                            max={axis === 'latitude' ? 90 : 180}
                            readOnly={disabled}
                            aria-invalid={
                              !Number.isFinite(point[ai]) ||
                              Math.abs(point[ai]) > (axis === 'latitude' ? 90 : 180)
                            }
                            value={Number.isFinite(point[ai]) ? point[ai] : ''}
                            onChange={(event) =>
                              update(
                                feature,
                                points.map((p, i) =>
                                  i === pi
                                    ? ai === 0
                                      ? [event.currentTarget.valueAsNumber, p[1]]
                                      : [p[0], event.currentTarget.valueAsNumber]
                                    : p
                                )
                              )
                            }
                          />
                        </StudioField>
                      );
                    })}
                  </div>
                  {!disabled ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pi === 0}
                        aria-label={pt('geometry.moveUp', { position: pi + 1 })}
                        onClick={() => {
                          const next = [...points];
                          [next[pi - 1], next[pi]] = [next[pi]!, next[pi - 1]!];
                          update(feature, next);
                        }}
                      >
                        {pt('geometry.up')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pi === points.length - 1}
                        aria-label={pt('geometry.moveDown', { position: pi + 1 })}
                        onClick={() => {
                          const next = [...points];
                          [next[pi + 1], next[pi]] = [next[pi]!, next[pi + 1]!];
                          update(feature, next);
                        }}
                      >
                        {pt('geometry.down')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={points.length <= (feature.geometry.type === 'Polygon' ? 3 : 2)}
                        aria-label={pt('geometry.removePoint', { position: pi + 1 })}
                        onClick={() =>
                          update(
                            feature,
                            points.filter((_, i) => i !== pi)
                          )
                        }
                      >
                        {pt('geometry.removePointShort')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {!disabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      totalPositions >= 1000 ||
                      points.length >= (feature.geometry.type === 'Polygon' ? 499 : 500)
                    }
                    onClick={() => update(feature, [...points, [Number.NaN, Number.NaN]])}
                  >
                    {pt('geometry.addPoint')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => commit(features.filter((f) => f.id !== feature.id))}
                  >
                    {pt('geometry.deleteFeature')}
                  </Button>
                </div>
              ) : null}
            </fieldset>
          </details>
        );
      })}
    </div>
  );
}
