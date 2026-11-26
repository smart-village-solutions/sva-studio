import {
  createMainserverMutationHeaders,
  getHostMediaAssetPersistentUrl,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  readMainserverMutationFailureOutcome,
  requestMainserverJson,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Input,
  isMainserverPrincipalReady,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  RichTextHtmlEditor,
  StudioDetailCard,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioField,
  Textarea,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { tourDetailPath, toursPath } from './descriptor.js';

const api = '/api/v1/mainserver/tours';
type Translate = ReturnType<typeof usePluginTranslation>;
type Stop = { key: string; name: string; description: string; latitude: string; longitude: string };
type Coordinates = { latitude: number; longitude: number };
const createStop = (): Stop => ({
  key: crypto.randomUUID(),
  name: '',
  description: '',
  latitude: '',
  longitude: '',
});

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

function Stations({
  pt,
  stops,
  setStops,
}: {
  pt: Translate;
  stops: Stop[];
  setStops: (next: Stop[]) => void;
}) {
  const change = (index: number, patch: Partial<Stop>) =>
    setStops(
      stops.map((stop, indexOfStop) => (indexOfStop === index ? { ...stop, ...patch } : stop))
    );
  const move = (index: number, target: number) => {
    const next = [...stops];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setStops(next);
  };
  return (
    <StudioDetailCard title={pt('stops')}>
      <ol className="space-y-4">
        {stops.map((stop, index) => (
          <li key={stop.key}>
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="font-medium">{pt('stopLabel', { number: index + 1 })}</legend>
              <StudioField id={`${stop.key}-name`} label={pt('name')}>
                <Input
                  id={`${stop.key}-name`}
                  required
                  maxLength={250}
                  value={stop.name}
                  onChange={(event) => change(index, { name: event.target.value })}
                />
              </StudioField>
              <StudioField id={`${stop.key}-description`} label={pt('tourDescription')}>
                <Textarea
                  id={`${stop.key}-description`}
                  value={stop.description}
                  onChange={(event) => change(index, { description: event.target.value })}
                />
              </StudioField>
              <div className="grid gap-3 sm:grid-cols-2">
                <StudioField id={`${stop.key}-latitude`} label={pt('latitude')}>
                  <Input
                    id={`${stop.key}-latitude`}
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={stop.latitude}
                    onChange={(event) => change(index, { latitude: event.target.value })}
                  />
                </StudioField>
                <StudioField id={`${stop.key}-longitude`} label={pt('longitude')}>
                  <Input
                    id={`${stop.key}-longitude`}
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={stop.longitude}
                    onChange={(event) => change(index, { longitude: event.target.value })}
                  />
                </StudioField>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  {pt('moveUp')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={index === stops.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  {pt('moveDown')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStops(stops.filter((item) => item.key !== stop.key))}
                >
                  {pt('removeStop')}
                </Button>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="secondary"
        disabled={stops.length >= 200}
        onClick={() => setStops([...stops, createStop()])}
      >
        {pt('addStop')}
      </Button>
    </StudioDetailCard>
  );
}

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

export function TourCreatePage({
  principalControl,
  instanceId,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel; instanceId?: string }>) {
  const pt = usePluginTranslation('tours');
  const navigate = useNavigate();
  const [stops, setStops] = useState<Stop[]>([]);
  const [principal, setPrincipal] = useState(principalControl?.value ?? 'user');
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [library, setLibrary] = useState<readonly { name: string; url: string }[] | null>(null);
  const [libraryState, setLibraryState] = useState<'loading' | 'error' | null>(null);
  const inFlight = useRef(false);
  const operation = useRef<{ body: string; key: string; principal: typeof principal } | undefined>(
    undefined
  );
  const [error, setError] = useState<'createError' | 'inputInvalid' | 'coordinatesInvalid' | null>(
    null
  );
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    void requestMainserverJson<{ data: readonly { id: string; name: string }[] }>({
      url: '/api/v1/mainserver/categories?dataType=tour',
      init: { signal: abort.signal },
    }).then(
      ({ data }) => {
        if (!abort.signal.aborted) setCategories(data);
      },
      () => undefined
    );
    return () => abort.abort();
  }, []);

  const loadLibrary = async () => {
    setLibraryState('loading');
    try {
      const items = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        instanceId,
        visibility: 'public',
      });
      setLibrary(
        items.flatMap((item) => {
          const url = getHostMediaAssetPersistentUrl(item);
          return item.visibility === 'public' &&
            item.mimeType?.startsWith('image/') &&
            url?.startsWith('https://')
            ? [{ name: readHostMediaAssetFileName(item) ?? item.id, url }]
            : [];
        })
      );
      setLibraryState(null);
    } catch {
      setLibraryState('error');
    }
  };

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
          <StudioDetailCard title={pt('basis')}>
            <MainserverPrincipalControl
              id="tour-principal"
              label={pt('principal')}
              value={principal}
              onChange={setPrincipal}
              options={resolveMainserverPrincipalOptions(principalControl, {
                value: 'user',
                label: pt('personal'),
              })}
              readinessByPrincipal={principalControl?.readinessByPrincipal}
            />
            <StudioField id="tour-name" label={pt('name')}>
              <Input id="tour-name" name="name" required maxLength={250} />
            </StudioField>
            <StudioField id="tour-length" label={pt('length')}>
              <Input
                id="tour-length"
                name="length"
                required
                type="number"
                min={0}
                max={2147483647}
                step={1}
              />
            </StudioField>
            <div className="space-y-2">
              <p id="tour-description-label" className="text-sm font-medium">
                {pt('tourDescription')}
              </p>
              <input name="description" type="hidden" value={description} />
              <RichTextHtmlEditor
                id="tour-description"
                labelId="tour-description-label"
                value={description}
                onChange={setDescription}
                disabled={busy}
                blockTypeOptions={[
                  { value: 'paragraph', label: pt('richText.paragraph') },
                  { value: 'heading-2', label: pt('richText.heading') },
                ]}
                toolbarLabels={{
                  mode: pt('richText.mode'),
                  visualMode: pt('richText.visual'),
                  htmlMode: pt('richText.html'),
                  blockType: pt('richText.blockType'),
                  bulletList: pt('richText.bullets'),
                  orderedList: pt('richText.numbered'),
                  bold: pt('richText.bold'),
                  italic: pt('richText.italic'),
                  underline: pt('richText.underline'),
                  clearFormatting: pt('richText.clear'),
                  undo: pt('richText.undo'),
                  redo: pt('richText.redo'),
                  link: pt('richText.link'),
                  linkPrompt: pt('richText.linkPrompt'),
                }}
              />
            </div>
            <StudioField id="tour-category" label={pt('categories')}>
              <select
                id="tour-category"
                name="category"
                className="min-h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{pt('unknown')}</option>
                {categories.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </StudioField>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['operator', 'email', 'phone'] as const).map((name) => (
                <StudioField key={name} id={`tour-${name}`} label={pt(name)}>
                  <Input
                    id={`tour-${name}`}
                    name={name}
                    type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                    maxLength={250}
                  />
                </StudioField>
              ))}
            </div>
          </StudioDetailCard>
          <StudioDetailCard title={pt('routeAndLocation')}>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['street', 'zip', 'city'] as const).map((name) => (
                <StudioField key={name} id={`tour-${name}`} label={pt(name)}>
                  <Input id={`tour-${name}`} name={name} maxLength={250} />
                </StudioField>
              ))}
            </div>
            <StudioField id="tour-route" label={pt('route')}>
              <Textarea id="tour-route" name="route" aria-describedby="tour-route-hint" />
            </StudioField>
            <p id="tour-route-hint" className="text-sm text-muted-foreground">
              {pt('routeHint')}
            </p>
          </StudioDetailCard>
          <Stations pt={pt} stops={stops} setStops={setStops} />
          <StudioDetailCard title={pt('media')}>
            <StudioField id="tour-media" label={pt('imageUrl')}>
              <Input
                id="tour-media"
                name="media"
                type="url"
                pattern="https://.+"
                value={image}
                onChange={(event) => setImage(event.target.value)}
              />
            </StudioField>
            <Button
              variant="secondary"
              type="button"
              disabled={libraryState === 'loading'}
              onClick={() => void loadLibrary()}
            >
              {pt('mediaLibrary')}
            </Button>
            {libraryState === 'loading' ? <p role="status">{pt('mediaLoading')}</p> : null}
            {libraryState === 'error' ? <p role="alert">{pt('mediaError')}</p> : null}
            {library?.length === 0 ? <p>{pt('mediaEmpty')}</p> : null}
            {library && library.length > 0 ? (
              <StudioField id="tour-media-library" label={pt('mediaLibrary')}>
                <select
                  id="tour-media-library"
                  className="min-h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={library.some(({ url }) => url === image) ? image : ''}
                  onChange={(event) => setImage(event.target.value)}
                >
                  <option value="">{pt('unknown')}</option>
                  {library.map(({ url, name }) => (
                    <option key={url} value={url}>
                      {name}
                    </option>
                  ))}
                </select>
              </StudioField>
            ) : null}
            <StudioField id="tour-caption" label={pt('caption')}>
              <Input id="tour-caption" name="caption" maxLength={250} />
            </StudioField>
            <StudioField id="tour-copyright" label={pt('copyright')}>
              <Input id="tour-copyright" name="copyright" maxLength={250} />
            </StudioField>
          </StudioDetailCard>
        </fieldset>
      </form>
    </StudioDetailPageTemplate>
  );
}
