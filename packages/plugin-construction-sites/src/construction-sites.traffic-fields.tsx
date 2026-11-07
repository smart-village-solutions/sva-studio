import { useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioDetailCard, StudioField } from '@sva/studio-ui-react';
import type { ConstructionSiteInput } from './contract.js';
import {
  constructionSiteFieldId,
  type ConstructionSiteFormProps,
} from './construction-sites.form.js';
import { ConstructionSiteGeometryFields } from './construction-sites.geometry-fields.js';
import { ConstructionSiteMap } from './construction-sites.map.js';
export function TrafficFields({ draft, change, errors }: ConstructionSiteFormProps) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <StudioDetailCard title={pt('fields.restrictions')} description={pt('editor.optional')}>
      {(['direction', 'cause'] as const).map((key) => (
        <StudioField key={key} id={`cs-${key}`} label={pt(`fields.${key}`)}>
          <Input
            id={`cs-${key}`}
            value={draft[key]}
            aria-invalid={errors.includes(key)}
            onChange={(event) => change(key, event.currentTarget.value)}
          />
        </StudioField>
      ))}
      {draft.restrictions.map((restriction, index) => (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          key={restriction.sourceIndex ?? `new-${index}`}
        >
          <StudioField
            id={constructionSiteFieldId(`restrictions.${index}.description`)}
            label={pt('fields.restrictions')}
            className="min-w-0 flex-1"
          >
            <Input
              id={constructionSiteFieldId(`restrictions.${index}.description`)}
              value={restriction.description}
              onChange={(event) =>
                change(
                  'restrictions',
                  draft.restrictions.map((item, position) =>
                    index === position ? { ...item, description: event.currentTarget.value } : item
                  )
                )
              }
            />
          </StudioField>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              change(
                'restrictions',
                draft.restrictions.filter((_, position) => position !== index)
              )
            }
          >
            {pt('actions.remove')}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => change('restrictions', [...draft.restrictions, { description: '' }])}
      >
        {pt('actions.add')}
      </Button>
    </StudioDetailCard>
  );
}

export function LocationFields(props: ConstructionSiteFormProps) {
  const { draft, change, errors } = props;
  const [activeLocation, setActiveLocation] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const features = draft.geometry?.features ?? [];
  const selectedFeatureId =
    features.find((feature) => feature.id === selectedId)?.id ?? features[0]?.id;
  const locationIndex = activeLocation < draft.locations.length ? activeLocation : 0;
  const pt = usePluginTranslation('construction-sites');
  const update = (index: number, value: Partial<ConstructionSiteInput['locations'][number]>) =>
    change(
      'locations',
      draft.locations.map((item, position) => (position === index ? { ...item, ...value } : item))
    );
  return (
    <StudioDetailCard title={pt('geometry.title')} description={pt('geometry.description')}>
      {draft.locations.map((location, index) => (
        <LocationRow
          key={location.sourceIndex ?? `new-${index}`}
          draft={draft}
          change={change}
          errors={errors}
          index={index}
          locationIndex={locationIndex}
          setActiveLocation={setActiveLocation}
          update={update}
        />
      ))}
      <AddLocation {...props} />
      <ConstructionSiteMap
        latitude={draft.locations[locationIndex]?.latitude ?? null}
        longitude={draft.locations[locationIndex]?.longitude ?? null}
        geometry={draft.geometry}
        selectedFeatureId={selectedFeatureId}
        onSelectFeature={setSelectedId}
        disabled={props.disabled}
        onDrawingChange={props.onGeometryDrawingChange}
        onGeometryChange={(geometry) => change('geometry', geometry)}
        onChange={(latitude, longitude) =>
          draft.locations.length
            ? update(locationIndex, { latitude, longitude })
            : change('locations', [{ name: '', latitude, longitude }])
        }
      />
      <ConstructionSiteGeometryFields
        {...props}
        selectedFeatureId={selectedFeatureId}
        onSelectFeature={setSelectedId}
        disabled={props.disabled || props.geometryDrawing === true}
      />
    </StudioDetailCard>
  );
}

function LocationRow({
  draft,
  change,
  errors,
  index,
  locationIndex,
  setActiveLocation,
  update,
}: Pick<ConstructionSiteFormProps, 'draft' | 'change' | 'errors'> & {
  index: number;
  locationIndex: number;
  setActiveLocation: (index: number) => void;
  update: (index: number, value: Partial<ConstructionSiteInput['locations'][number]>) => void;
}) {
  const pt = usePluginTranslation('construction-sites');
  const location = draft.locations[index]!;
  return (
    <div key={location.sourceIndex ?? `new-${index}`} className="space-y-4">
      <StudioField
        id={constructionSiteFieldId(`locations.${index}.name`)}
        label={pt('fields.name')}
      >
        <Input
          id={constructionSiteFieldId(`locations.${index}.name`)}
          value={location.name}
          onChange={(event) => update(index, { name: event.currentTarget.value })}
        />
      </StudioField>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['latitude', 'longitude'] as const).map((key) => (
          <StudioField
            key={key}
            id={constructionSiteFieldId(`locations.${index}.${key}`)}
            label={pt(`fields.${key}`)}
            error={
              errors.includes(`locations.${index}.${key}`)
                ? pt('validation.incomplete_coordinates')
                : undefined
            }
          >
            <Input
              id={constructionSiteFieldId(`locations.${index}.${key}`)}
              type="number"
              step="any"
              value={location[key] ?? ''}
              aria-invalid={errors.includes(`locations.${index}.${key}`)}
              onChange={(event) =>
                update(index, {
                  [key]:
                    event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber,
                })
              }
            />
          </StudioField>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        aria-pressed={locationIndex === index}
        onClick={() => setActiveLocation(index)}
      >
        {pt('geometry.showLocation', { position: index + 1 })}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          change(
            'locations',
            draft.locations.filter((_, position) => position !== index)
          )
        }
      >
        {pt('actions.remove')}
      </Button>
    </div>
  );
}

function AddLocation({ draft, change }: ConstructionSiteFormProps) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <>
      {!draft.locations.length ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => change('locations', [{ name: '', latitude: null, longitude: null }])}
        >
          {pt('actions.add')}
        </Button>
      ) : null}
    </>
  );
}
