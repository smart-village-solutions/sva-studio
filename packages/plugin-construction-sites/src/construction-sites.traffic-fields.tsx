import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioDetailCard, StudioField } from '@sva/studio-ui-react';
import type { ConstructionSiteInput } from './contract.js';
import {
  constructionSiteFieldId,
  type ConstructionSiteFormProps,
} from './construction-sites.form.js';
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
        <div className="flex items-end gap-2" key={restriction.sourceIndex ?? `new-${index}`}>
          <StudioField
            id={constructionSiteFieldId(`restrictions.${index}.description`)}
            label={pt('fields.restrictions')}
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
  const pt = usePluginTranslation('construction-sites');
  const update = (index: number, value: Partial<ConstructionSiteInput['locations'][number]>) =>
    change(
      'locations',
      draft.locations.map((item, position) => (position === index ? { ...item, ...value } : item))
    );
  return (
    <StudioDetailCard title={pt('fields.locations')} description={pt('editor.primary')}>
      {draft.locations.map((location, index) => (
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
          <ConstructionSiteMap
            latitude={location.latitude}
            longitude={location.longitude}
            disabled={props.disabled}
            onChange={(latitude, longitude) => update(index, { latitude, longitude })}
          />
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
      ))}
      <AddLocation {...props} />
    </StudioDetailCard>
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
