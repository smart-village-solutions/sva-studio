import {
  createMainserverReadHeaders,
  MainserverApiError,
  requestMainserverJson,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { toursPath } from './descriptor.js';
import { TourBasisFields, TourRouteFields } from './tour-create-fields.js';
import { Stations } from './tour-create-stations.js';
import {
  buildTourEdit,
  editableStops,
  routeValue,
  tourAudioTarget,
  type EditableTour,
} from './tour-edit-data.js';
import {
  serializeTourAudio,
  TourAudioFields,
  TourAudioPicker,
  useTourAudio,
} from './tour-audio.js';
import { useTourSave } from './tour-save.js';

type EditProps = {
  id: string;
  principalControl: MainserverPrincipalControlModel;
  canSave: boolean;
};
type EditorData = { tour: EditableTour; contextBinding: string };
type EditState = { data: EditorData } | { error: 'forbidden' | 'notFound' | 'error' };

function useEditableTour(id: string, principal: MainserverPrincipalControlModel['value']) {
  const [result, setResult] = useState<EditState>();
  useEffect(() => {
    const abort = new AbortController();
    const complete = (result: EditState) => {
      if (!abort.signal.aborted) setResult(result);
    };
    let contextBinding: string | undefined;
    void requestMainserverJson<{ data: EditableTour }>({
      url: `/api/v1/mainserver/tours/${encodeURIComponent(id)}/editor`,
      init: {
        headers: createMainserverReadHeaders(principal),
        signal: abort.signal,
        cache: 'no-store',
      },
      onResponse: (response) => {
        contextBinding = response.contextBinding;
      },
    }).then(
      ({ data }) => {
        complete(contextBinding ? { data: { tour: data, contextBinding } } : { error: 'error' });
      },
      (error: unknown) => {
        const code = error instanceof MainserverApiError ? error.code : undefined;
        complete({
          error: code === 'not_found' ? 'notFound' : code === 'forbidden' ? 'forbidden' : 'error',
        });
      }
    );
    return () => abort.abort();
  }, [id, principal]);
  return result;
}

type EditFormProps = {
  snapshot: EditorData;
  saved: boolean;
  canSave: boolean;
  onSaved: (tour: EditableTour) => void;
  principalControl: MainserverPrincipalControlModel;
};

function useEditTourForm({ snapshot, principalControl, canSave, onSaved }: EditFormProps) {
  const { tour, contextBinding } = snapshot;
  const [stops, setStops] = useState(() => editableStops(tour));
  const markAudioChanged: () => void = () => save.markChanged();
  const audio = useTourAudio(tour, canSave, markAudioChanged);
  const targets = [tourAudioTarget, ...stops.map(({ key }) => key)];
  const usages = audio.usagesFor(targets);
  const save = useTourSave<EditableTour>({
    url: `/api/v1/mainserver/tours/${encodeURIComponent(tour.id)}`,
    method: 'PATCH',
    principalControl,
    contextBinding,
    media: {
      usages,
      instanceId: audio.mediaInstanceId,
      syncReferences: audio.shouldSync(targets),
    },
    buildBody: (form, resolutions) => {
      const update = buildTourEdit(
        form,
        stops,
        tour,
        serializeTourAudio(audio.audio, targets, resolutions)
      );
      return Object.keys(update.patch).length > 0 ? update : undefined;
    },
    onSaved,
  });
  return { audio, stops, setStops, save };
}

function EditForm(props: EditFormProps) {
  const { snapshot, saved, canSave, principalControl } = props;
  const { tour } = snapshot;
  const pt = usePluginTranslation('tours');
  const { audio, stops, setStops, save } = useEditTourForm(props);
  const { principal, busy, dirty, error, submit, markChanged, referenceSyncPending } = save;
  const storedStops = new Map(tour.tourStops.map((stop) => [stop.id, stop]));
  return (
    <StudioDetailPageTemplate
      title={tour.name || pt('edit')}
      actions={
        <Button variant="secondary" asChild>
          <Link to={toursPath}>{pt('back')}</Link>
        </Button>
      }
      primaryAction={
        <Button
          form="tour-edit-form"
          type="submit"
          disabled={busy || !dirty || !canSave || error === 'editConflict'}
        >
          {pt('save')}
        </Button>
      }
    >
      <form
        id="tour-edit-form"
        className="space-y-5"
        onChange={markChanged}
        onSubmit={(event) => {
          if (canSave && error !== 'editConflict') void submit(event);
          else event.preventDefault();
        }}
      >
        {error ? <StudioErrorState>{pt(error)}</StudioErrorState> : null}
        {saved && !dirty ? <p role="status">{pt('saved')}</p> : null}
        <fieldset disabled={busy || referenceSyncPending || !canSave} className="space-y-5">
          <TourBasisFields
            pt={pt}
            busy={busy}
            principal={principal}
            principalControl={principalControl}
            existing={tour}
            onDescriptionChange={markChanged}
          />
          <TourRouteFields pt={pt} initialRoute={routeValue(tour)} />
          <TourAudioFields editor={audio} target={tourAudioTarget} />
          <Stations
            pt={pt}
            stops={stops}
            setStops={(next) => {
              markChanged();
              setStops(next);
            }}
            renderAudio={(stop) => (
              <TourAudioFields
                editor={audio}
                target={stop.key}
                inherited={
                  stop.id ? storedStops.get(stop.id)?.inheritedPoiMediaContents : undefined
                }
              />
            )}
          />
        </fieldset>
        <TourAudioPicker editor={audio} />
      </form>
    </StudioDetailPageTemplate>
  );
}

function LoadedEditor({
  initial,
  principalControl,
  canSave,
}: {
  initial: EditorData;
  canSave: boolean;
  principalControl: MainserverPrincipalControlModel;
}) {
  const [saved, setSaved] = useState<{ tour: EditableTour; version: number }>();
  return (
    <EditForm
      key={saved?.version ?? 0}
      snapshot={saved ? { ...initial, tour: saved.tour } : initial}
      principalControl={principalControl}
      saved={!!saved}
      canSave={canSave}
      onSaved={(tour) => setSaved((previous) => ({ tour, version: (previous?.version ?? 0) + 1 }))}
    />
  );
}

export function TourEditPage({ id, principalControl, canSave }: EditProps) {
  const pt = usePluginTranslation('tours');
  const result = useEditableTour(id, principalControl.value);
  if (result && 'data' in result)
    return (
      <LoadedEditor initial={result.data} principalControl={principalControl} canSave={canSave} />
    );
  return (
    <StudioDetailPageTemplate
      title={pt('edit')}
      actions={
        <Button variant="secondary" asChild>
          <Link to={toursPath}>{pt('back')}</Link>
        </Button>
      }
    >
      {result ? (
        <StudioErrorState>{pt(result.error)}</StudioErrorState>
      ) : (
        <StudioLoadingState>{pt('loading')}</StudioLoadingState>
      )}
    </StudioDetailPageTemplate>
  );
}
