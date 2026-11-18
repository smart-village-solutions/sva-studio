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
  useAccessTransferEditor,
  type AccessTransferEditor,
} from './admin.access-transfer-state.js';
import { TransferSelection } from './admin.access-transfer-selection.js';
function TransferScope({ editor }: { editor: AccessTransferEditor }) {
  const pt = usePluginTranslation('ssf');
  const { preview, label, source, target, reason } = editor;
  if (!preview) return null;
  return (
    <>
      {' '}
      <dl>
        <dt>{pt('transfer.source')}</dt>
        <dd>
          {label(source)} · {source}
        </dd>
        <dt>{pt('transfer.target')}</dt>
        <dd>
          {label(target)} · {preview.transfer.targetKey.userSub}
        </dd>
        <dt>{pt('transfer.targetKey')}</dt>
        <dd>
          {preview.transfer.targetKey.version} ·{' '}
          <code>{preview.transfer.targetKey.fingerprint}</code>
        </dd>
        <dt>{pt('keys.version')}</dt>
        <dd>
          {preview.id.version} · <code>{preview.id.fingerprint}</code>
        </dd>
        <dt>{pt('transfer.reason')}</dt>
        <dd>{reason}</dd>
        <dt>{pt('transfer.selection')}</dt>
        <dd>
          <ul>
            {preview.members.map((m) => (
              <li key={m.keyId}>
                {m.conversationId} · {m.keyId}
              </li>
            ))}
          </ul>
        </dd>
      </dl>
    </>
  );
}
function ConfirmationControls({ editor }: { editor: AccessTransferEditor }) {
  const pt = usePluginTranslation('ssf');
  const {
    task,
    fileInput,
    fileEpoch,
    fileChanged,
    hasLocalKey,
    confirmed,
    setConfirmed,
    commit,
    discard,
  } = editor;
  return (
    <>
      <label>
        {pt('transfer.file')}{' '}
        <input
          type="file"
          ref={fileInput}
          key={fileEpoch}
          accept=".json,application/json"
          disabled={task.busy}
          onChange={(e) => fileChanged(e.target.files?.[0])}
        />
      </label>
      <label>
        <input
          type="checkbox"
          disabled={task.busy || !hasLocalKey}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{' '}
        {pt('transfer.confirm')}
      </label>
      <div className="flex gap-3">
        <Button disabled={task.busy || !hasLocalKey || !confirmed} onClick={() => void commit()}>
          {pt('transfer.commit')}
        </Button>
        <Button variant="secondary" disabled={task.busy} onClick={discard}>
          {pt('keys.cancel')}
        </Button>
      </div>
    </>
  );
}

export const AccessTransferForm = (actor: RecordingActor) => {
  const pt = usePluginTranslation('ssf');
  const editor = useAccessTransferEditor(actor);
  const { task, submission, preview, receipts, label, commit, people, reload } = editor;
  return (
    <StudioOverviewPageTemplate
      title={pt('administration.pages.access-transfers')}
      description={pt('transfer.description')}
    >
      <RecordingError code={task.error} />
      <TransferSelection editor={editor} />
      {submission && (
        <StudioSection title={pt('keys.confirmedStatus')}>
          <p>
            {submission.transferId} · {label(submission.targetUserSub)} · {pt('transfer.targetKey')}{' '}
            {submission.targetKeyVersion}
          </p>
          <Button disabled={task.busy} onClick={() => void commit()}>
            {pt('keys.retryConfirmed')}
          </Button>
        </StudioSection>
      )}
      {preview && (
        <StudioSection title={pt('transfer.confirmTitle')}>
          <TransferScope editor={editor} />
          <ConfirmationControls editor={editor} />
        </StudioSection>
      )}
      {receipts.map((r) => (
        <StudioFormSummary key={r.transferId} kind="success">
          {pt('transfer.receipt')} {r.transferId} · {r.committedAt} · {label(r.targetUserSub)} ·{' '}
          {pt('transfer.targetKey')} {r.targetKeyVersion} · {pt('transfer.keyCount')}{' '}
          {r.grantedKeyIds.length}
        </StudioFormSummary>
      ))}
      {task.error && !people.length && (
        <Button onClick={() => void reload()}>{pt('keys.reload')}</Button>
      )}
    </StudioOverviewPageTemplate>
  );
};
export const SsfAccessTransfersPage = () => (
  <RecordingContext form={AccessTransferForm} permission="ssf.recording.access.transfer" />
);
