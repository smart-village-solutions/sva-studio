import { GeometryPoint } from './construction-sites.geometry-points.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
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
    commit(replacePoints(features, feature, points));
  const add = (type: 'LineString' | 'Polygon') => {
    const feature = newFeature(type);
    onSelectFeature?.(feature.id);
    commit([...features, feature]);
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
      {features.map((feature, index) => (
        <FeatureFields
          key={feature.id}
          feature={feature}
          index={index}
          selectedFeatureId={selectedFeatureId}
          onSelectFeature={onSelectFeature}
          disabled={disabled}
          hasErrors={hasErrors}
          totalPositions={totalPositions}
          update={update}
          commit={commit}
          features={features}
        />
      ))}
    </div>
  );
}

type FeatureProps = {
  feature: ConstructionSiteGeometryFeature;
  index: number;
  selectedFeatureId?: string;
  onSelectFeature?: (id: string) => void;
  disabled?: boolean;
  hasErrors: boolean;
  totalPositions: number;
  features: ConstructionSiteGeometryV1['features'];
  update: (feature: ConstructionSiteGeometryFeature, points: [number, number][]) => void;
  commit: (features: ConstructionSiteGeometryV1['features']) => void;
};
function FeatureFields({
  feature,
  index,
  selectedFeatureId,
  onSelectFeature,
  disabled,
  hasErrors,
  totalPositions,
  update,
  commit,
  features,
}: FeatureProps) {
  const pt = usePluginTranslation('construction-sites');
  const points =
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0].slice(0, -1)
      : feature.geometry.coordinates;
  const name = pt('geometry.feature', {
    kind: pt(feature.geometry.type === 'Polygon' ? 'geometry.area' : 'geometry.route'),
    position: index + 1,
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
            kind: pt(feature.geometry.type === 'Polygon' ? 'geometry.area' : 'geometry.route'),
            position: index + 1,
          })}
        </legend>
        {points.map((point, pi) => (
          <GeometryPoint
            key={pi}
            point={point}
            index={pi}
            points={points}
            feature={feature}
            disabled={disabled}
            update={update}
          />
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
}

function newFeature(type: 'LineString' | 'Polygon'): ConstructionSiteGeometryFeature {
  const points: [number, number][] = Array.from({ length: type === 'Polygon' ? 3 : 2 }, () => [
    Number.NaN,
    Number.NaN,
  ]);
  return {
    type: 'Feature',
    id: crypto.randomUUID(),
    properties: {},
    geometry:
      type === 'Polygon'
        ? { type, coordinates: [[...points, points[0]!]] }
        : { type, coordinates: points },
  };
}

function replacePoints(
  features: ConstructionSiteGeometryV1['features'],
  feature: ConstructionSiteGeometryFeature,
  points: [number, number][]
): ConstructionSiteGeometryV1['features'] {
  return features.map((f) =>
    f.id === feature.id
      ? {
          ...f,
          geometry:
            feature.geometry.type === 'Polygon'
              ? { type: 'Polygon', coordinates: [[...points, points[0]!]] }
              : { type: 'LineString', coordinates: points },
        }
      : f
  );
}
