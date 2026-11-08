import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField } from '@sva/studio-ui-react';
import type { ConstructionSiteGeometryFeature } from './construction-sites.geometry.js';
type PointProps = {
  point: [number, number];
  index: number;
  feature: ConstructionSiteGeometryFeature;
  points: [number, number][];
  disabled?: boolean;
  update: (feature: ConstructionSiteGeometryFeature, points: [number, number][]) => void;
};
export function GeometryPoint(props: PointProps) {
  const { index, feature, points, disabled, update } = props;
  const pt = usePluginTranslation('construction-sites');
  const move = (offset: number) => {
    const next = [...points];
    [next[index + offset], next[index]] = [next[index]!, next[index + offset]!];
    update(feature, next);
  };
  return (
    <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-end">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        {(['latitude', 'longitude'] as const).map((axis) => (
          <GeometryAxis key={axis} {...props} axis={axis} />
        ))}
      </div>
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={index === 0}
            aria-label={pt('geometry.moveUp', { position: index + 1 })}
            onClick={() => move(-1)}
          >
            {pt('geometry.up')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={index === points.length - 1}
            aria-label={pt('geometry.moveDown', { position: index + 1 })}
            onClick={() => move(1)}
          >
            {pt('geometry.down')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={points.length <= (feature.geometry.type === 'Polygon' ? 3 : 2)}
            aria-label={pt('geometry.removePoint', { position: index + 1 })}
            onClick={() =>
              update(
                feature,
                points.filter((_, i) => i !== index)
              )
            }
          >
            {pt('geometry.removePointShort')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
function GeometryAxis({
  point,
  index,
  feature,
  points,
  disabled,
  update,
  axis,
}: PointProps & { axis: 'latitude' | 'longitude' }) {
  const pt = usePluginTranslation('construction-sites');
  const ai = axis === 'longitude' ? 0 : 1;
  const limit = axis === 'latitude' ? 90 : 180;
  const id = `cs-geometry-${feature.id}-${index}-${axis}`;
  return (
    <StudioField
      id={id}
      label={pt('geometry.coordinate', { position: index + 1, axis: pt(`fields.${axis}`) })}
    >
      <Input
        id={id}
        type="number"
        step="any"
        inputMode="decimal"
        min={-limit}
        max={limit}
        readOnly={disabled}
        aria-invalid={!Number.isFinite(point[ai]) || Math.abs(point[ai]) > limit}
        value={Number.isFinite(point[ai]) ? point[ai] : ''}
        onChange={(event) =>
          update(
            feature,
            points.map((p, i) =>
              i === index
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
}
