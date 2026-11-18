import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioFormSummary,
  StudioOverviewPageTemplate,
  StudioSection,
} from '@sva/studio-ui-react';
import {
  RecordingContext,
  RecordingError,
  type RecordingActor,
} from './admin.recording-key-session.js';
import {
  useOrganisationKeyEditor,
  type OrganisationKeyEditor,
} from './admin.organisation-key-state.js';

function KeyHistory({ editor }: { editor: OrganisationKeyEditor }) {
  const pt = usePluginTranslation('ssf');
  const { list, pending, submission, task, create, reload } = editor;
  return (
    <StudioSection title={pt('keys.history')}>
      {list ? (
        <>
          {!list.activeKeyId && <p>{pt('keys.noActive')}</p>}
          <ul>
            {list.keys.map((k) => (
              <li key={k.keyId}>
                {pt('keys.version')} {k.version} · {pt('keys.states.' + k.state)} ·{' '}
                <code>{k.fingerprint}</code>
              </li>
            ))}
          </ul>
          {!pending && !submission && (
            <Button disabled={task.busy} onClick={() => void create()}>
              {pt(list.activeKeyId ? 'keys.replace' : 'keys.create')}
            </Button>
          )}
        </>
      ) : (
        <Button disabled={task.busy} onClick={() => void reload()}>
          {pt(task.busy ? 'status.loading' : 'keys.reload')}
        </Button>
      )}
    </StudioSection>
  );
}

function CustodyPanel({ editor }: { editor: OrganisationKeyEditor }) {
  const pt = usePluginTranslation('ssf');
  const {
    pending,
    exportButton,
    download,
    print,
    saved,
    exported,
    setSaved,
    activate,
    cancel,
    task,
  } = editor;
  if (!pending) return null;
  return (
    <StudioSection title={pt('keys.custody')}>
      <p>{pt('keys.custodyNotice')}</p>
      <p>
        {pt('keys.version')} {pending.id.version} · <code>{pending.id.fingerprint}</code>
      </p>
      <div className="flex flex-wrap gap-3">
        <Button ref={exportButton} variant="secondary" onClick={download}>
          {pt('keys.download')}
        </Button>
        <Button variant="secondary" onClick={print}>
          {pt('keys.print')}
        </Button>
      </div>
      <label>
        <input
          type="checkbox"
          checked={saved}
          disabled={task.busy || !exported}
          onChange={(e) => setSaved(e.target.checked)}
        />{' '}
        {pt('keys.saved')}
      </label>
      <div className="flex gap-3">
        <Button disabled={!saved || task.busy} onClick={() => void activate()}>
          {pt('keys.activate')}
        </Button>
        <Button variant="secondary" disabled={task.busy} onClick={cancel}>
          {pt('keys.cancel')}
        </Button>
      </div>
    </StudioSection>
  );
}

export const OrganisationKeyForm = (actor: RecordingActor) => {
  const pt = usePluginTranslation('ssf');
  const editor = useOrganisationKeyEditor(actor);
  const { submission, done, task, activate } = editor;
  return (
    <StudioOverviewPageTemplate
      title={pt('administration.pages.organisation-keys')}
      description={pt('keys.replaceNotice')}
    >
      <RecordingError code={task.error} />
      {done && <StudioFormSummary kind="success">{pt('keys.activated')}</StudioFormSummary>}
      <KeyHistory editor={editor} />
      {submission && (
        <StudioSection title={pt('keys.confirmedStatus')}>
          <p>{submission.preparationId}</p>
          <Button disabled={task.busy} onClick={() => void activate()}>
            {pt('keys.retryConfirmed')}
          </Button>
        </StudioSection>
      )}
      <CustodyPanel editor={editor} />
    </StudioOverviewPageTemplate>
  );
};
export const SsfOrganisationKeysPage = () => (
  <RecordingContext form={OrganisationKeyForm} permission="ssf.configuration.tenant.manage" />
);
