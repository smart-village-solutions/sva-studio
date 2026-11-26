import {
  createMainserverMutationHeaders,
  readMainserverMutationFailureOutcome,
  requestMainserverJson,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  isMainserverPrincipalReady,
  StudioDetailPageTemplate,
  StudioErrorState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef, useState, type FormEvent } from 'react';

import { tourDetailPath, toursPath } from './descriptor.js';
import { TourBasisFields, TourMediaFields, TourRouteFields } from './tour-create-fields.js';
import { Stations, type Stop } from './tour-create-stations.js';

const api = '/api/v1/mainserver/tours';
type Coordinates = { latitude: number; longitude: number };
const parsePoint = (latitude: string, longitude: string): Coordinates => {
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  if (
    !latitude.trim() ||
    !longitude.trim() ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    throw new Error('coordinatesInvalid');
  return point;
};

const buildDraft = (form: FormData, stops: readonly Stop[]) => {
  const field = (name: string) => String(form.get(name) ?? '').trim() || undefined;
  const route = field('route')
    ?.split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const coordinates = line.trim().split(/\s+/u);
      if (coordinates.length !== 2) throw new Error('coordinatesInvalid');
      return parsePoint(coordinates[0]!, coordinates[1]!);
    });
  if (route?.length === 1) throw new Error('coordinatesInvalid');
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
    ...(route?.length ? { geometryTourData: route } : {}),
    tourStops: stops.map((stop) => ({
      name: stop.name.trim(),
      description: stop.description.trim() || undefined,
      ...(stop.latitude || stop.longitude
        ? { location: { geoLocation: parsePoint(stop.latitude, stop.longitude) } }
        : {}),
    })),
  };
};

function useCreateTourDraft(
  principalControl: MainserverPrincipalControlModel | undefined,
  stops: readonly Stop[]
) {
  const navigate = useNavigate();
  const principal = principalControl?.value ?? 'user';
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const operation = useRef<{ body: string; key: string; principal: typeof principal } | undefined>(
    undefined
  );
  const [error, setError] = useState<'createError' | 'inputInvalid' | 'coordinatesInvalid' | null>(
    null
  );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !isMainserverPrincipalReady(principalControl, principal)) return;
    let body: string;
    try {
      body = JSON.stringify(buildDraft(new FormData(event.currentTarget), stops));
    } catch {
      setError('coordinatesInvalid');
      return;
    }
    if (
      operation.current &&
      (operation.current.body !== body || operation.current.principal !== principal)
    ) {
      setError('createError');
      return;
    }
    operation.current ??= { body, key: crypto.randomUUID(), principal };
    const { key } = operation.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data } = await requestMainserverJson<{ data: { id: string } }>({
        url: api,
        init: {
          method: 'POST',
          headers: createMainserverMutationHeaders(principal, { 'Idempotency-Key': key }, key),
          body,
        },
      });
      await navigate({ to: tourDetailPath, params: { id: data.id } });
    } catch (failure) {
      if (readMainserverMutationFailureOutcome(failure) === 'not_applied') {
        operation.current = undefined;
        setError('inputInvalid');
      } else setError('createError');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { principal, busy, error, submit };
}

export function TourCreatePage({
  principalControl,
  instanceId,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel; instanceId?: string }>) {
  const pt = usePluginTranslation('tours');
  const [stops, setStops] = useState<Stop[]>([]);
  const { principal, busy, error, submit } = useCreateTourDraft(principalControl, stops);

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
      <form id="tour-draft-form" className="space-y-5" onSubmit={(event) => void submit(event)}>
        {error ? <StudioErrorState>{pt(error)}</StudioErrorState> : null}
        <fieldset disabled={busy} className="space-y-5">
          <TourBasisFields
            pt={pt}
            busy={busy}
            principal={principal}
            principalControl={principalControl}
          />
          <TourRouteFields pt={pt} />
          <Stations pt={pt} stops={stops} setStops={setStops} />
          <TourMediaFields pt={pt} instanceId={instanceId} />
        </fieldset>
      </form>
    </StudioDetailPageTemplate>
  );
}
