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
import {
  serializeTourAudio,
  TourAudioFields,
  TourAudioPicker,
  useTourAudio,
} from './tour-audio.js';
import { buildTourDraft, tourAudioTarget } from './tour-edit-data.js';
import { TourMediaFields } from './tour-create-media.js';
import { Stations, type Stop } from './tour-create-stations.js';
import { useTourSave } from './tour-save.js';

const api = '/api/v1/mainserver/tours';
function useTourDraft(principalControl?: MainserverPrincipalControlModel, instanceId?: string) {
  const [stops, setStops] = useState<Stop[]>([]);
  const navigate = useNavigate();
  const markAudioChanged: () => void = () => save.markChanged();
  const audio = useTourAudio(undefined, true, markAudioChanged, instanceId);
  const targets = [tourAudioTarget, ...stops.map(({ key }) => key)];
  const usages = audio.usagesFor(targets);
  const save = useTourSave<{ id: string }>({
    url: api,
    method: 'POST',
    principalControl,
    media: {
      usages,
      instanceId: audio.mediaInstanceId,
      syncReferences: audio.shouldSync(targets),
    },
    buildBody: (form, resolutions) =>
      buildTourDraft(form, stops, serializeTourAudio(audio.audio, targets, resolutions)),
    onSaved: async (data) => {
      await navigate({ to: tourDetailPath, params: { id: data.id } });
    },
  });
  return { audio, stops, setStops, save };
}

export function TourCreatePage({
  principalControl,
  instanceId,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel; instanceId?: string }>) {
  const pt = usePluginTranslation('tours');
  const { audio, stops, setStops, save } = useTourDraft(principalControl, instanceId);
  const { principal, busy, error, submit, markChanged, referenceSyncPending } = save;

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
        <fieldset disabled={busy || referenceSyncPending} className="space-y-5">
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
            renderAudio={(stop) => <TourAudioFields editor={audio} target={stop.key} />}
          />
          <TourMediaFields pt={pt} instanceId={instanceId} />
          <TourAudioFields editor={audio} target={tourAudioTarget} />
        </fieldset>
        <TourAudioPicker editor={audio} />
      </form>
    </StudioDetailPageTemplate>
  );
}
