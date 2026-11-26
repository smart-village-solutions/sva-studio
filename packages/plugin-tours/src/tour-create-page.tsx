import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  isMainserverPrincipalReady,
  StudioDetailPageTemplate,
  StudioErrorState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { tourDetailPath, toursPath } from './descriptor.js';
import { TourBasisFields, TourRouteFields } from './tour-create-fields.js';
import { TourMediaFields } from './tour-create-media.js';
import { Stations, type Stop } from './tour-create-stations.js';
import { parsePoint, parseRoute } from './tour-coordinates.js';
import { useTourSave } from './tour-save.js';

const api = '/api/v1/mainserver/tours';
const buildDraft = (form: FormData, stops: readonly Stop[]) => {
  const field = (name: string) => String(form.get(name) ?? '').trim() || undefined;
  const route = parseRoute(field('route') ?? '');
  const category = field('category');
  const company = field('operator');
  const media = field('media');
  const address = { street: field('street'), city: field('city'), zip: field('zip') };
  const contact = { email: field('email'), phone: field('phone') };
  return {
    name: field('name'),
    lengthKm: Number(field('length')),
    visible: false as const,
    description: field('description'),
    ...(category ? { categories: [{ id: category }] } : {}),
    ...(Object.values(address).some(Boolean) ? { addresses: [address] } : {}),
    ...(Object.values(contact).some(Boolean) ? { contact } : {}),
    ...(company ? { operatingCompany: { name: company } } : {}),
    ...(media
      ? {
          mediaContents: [
            {
              contentType: 'image',
              sourceUrl: { url: media },
              copyright: field('copyright'),
              captionText: field('caption'),
            },
          ],
        }
      : {}),
    ...(route.length ? { geometryTourData: route } : {}),
    tourStops: stops.map((stop) => ({
      name: stop.name.trim(),
      description: stop.description.trim() || undefined,
      ...(stop.latitude || stop.longitude
        ? { location: { geoLocation: parsePoint(stop.latitude, stop.longitude) } }
        : {}),
    })),
  };
};

export function TourCreatePage({
  principalControl,
  instanceId,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel; instanceId?: string }>) {
  const pt = usePluginTranslation('tours');
  const [stops, setStops] = useState<Stop[]>([]);
  const navigate = useNavigate();
  const { principal, busy, error, submit, markChanged } = useTourSave<{ id: string }>({
    url: api,
    method: 'POST',
    principalControl,
    buildBody: (form) => buildDraft(form, stops),
    onSaved: async (data) => {
      await navigate({ to: tourDetailPath, params: { id: data.id } });
    },
  });

  return (
    <StudioDetailPageTemplate
      title={pt('create')}
      actions={
        <Button variant="secondary" asChild>
          <Link to={toursPath}>{pt('back')}</Link>
        </Button>
      }
      primaryAction={
        <Button
          form="tour-draft-form"
          type="submit"
          disabled={busy || !isMainserverPrincipalReady(principalControl, principal)}
        >
          {pt('saveDraft')}
        </Button>
      }
    >
      <form
        id="tour-draft-form"
        className="space-y-5"
        onChange={markChanged}
        onSubmit={(event) => void submit(event)}
      >
        {error ? (
          <StudioErrorState>{pt(error === 'saveError' ? 'createError' : error)}</StudioErrorState>
        ) : null}
        <fieldset disabled={busy} className="space-y-5">
          <TourBasisFields
            pt={pt}
            busy={busy}
            principal={principal}
            principalControl={principalControl}
            onDescriptionChange={markChanged}
          />
          <TourRouteFields pt={pt} />
          <Stations
            pt={pt}
            stops={stops}
            setStops={(nextStops) => {
              markChanged();
              setStops(nextStops);
            }}
          />
          <TourMediaFields pt={pt} instanceId={instanceId} />
        </fieldset>
      </form>
    </StudioDetailPageTemplate>
  );
}
