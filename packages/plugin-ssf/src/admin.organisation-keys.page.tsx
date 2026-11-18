import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioFormSummary,
  StudioOverviewPageTemplate,
  StudioSection,
  useStudioEditorLeaveGuard,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestOperation } from './organisation-key-client.js';
import {
  activationProof,
  b64,
  createOrganisationKeyFile,
  generateOrganisationKey,
  importOrganisationKey,
} from './organisation-key-crypto.js';
import type { Activation, KeyIdentity, OrganisationKey } from './organisation-key-contracts.js';
import {
  RecordingContext,
  RecordingError,
  useRecordingTask,
  type RecordingActor,
} from './admin.recording-key-session.js';

interface Pending {
  prep: Activation;
  id: KeyIdentity;
  previous: string | null;
}
interface ActivationSubmission {
  preparationId: string;
  keyId: string;
  body: { proof: string; savedConfirmation: true };
}
export const OrganisationKeyForm = ({ tenantId, actor }: RecordingActor) => {
  const pt = usePluginTranslation('ssf'),
    task = useRecordingTask();
  const [list, setList] = useState<{ keys: OrganisationKey[]; activeKeyId: string | null } | null>(
      null
    ),
    [pending, setPending] = useState<Pending | null>(null),
    [submission, setSubmission] = useState<ActivationSubmission | null>(null),
    [saved, setSaved] = useState(false),
    [exported, setExported] = useState(false),
    [done, setDone] = useState(false);
  const custody = useRef<{ key: CryptoKey; file: string } | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const exportButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pending) exportButton.current?.focus();
  }, [pending]);
  const frame = useRef<HTMLIFrameElement | null>(null),
    link = useRef<string | null>(null);
  const release = useCallback(() => {
    frame.current?.remove();
    frame.current = null;
    if (link.current) {
      URL.revokeObjectURL(link.current);
      link.current = null;
    }
  }, []);
  const clear = useCallback(() => {
    clearTimeout(deadline.current);
    custody.current = null;
    release();
    setPending(null);
    setSaved(false);
    setExported(false);
  }, [release]);
  const cancel = () => {
    if (submission) return;
    task.cancel();
    clear();
    if (pending)
      void requestOperation('abandon', { id: pending.prep.preparationId }).catch(() => undefined);
  };
  useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: !!pending || !!submission,
    onDiscard: cancel,
  });
  const load = useCallback(async (signal: AbortSignal) => {
    setList(null);
    const result = await requestOperation('list', { signal });
    signal.throwIfAborted();
    setList(result);
    return result;
  }, []);
  useEffect(() => {
    void task.run(async (signal) => {
      await load(signal);
    });
    return () => {
      custody.current = null;
      release();
    };
  }, [task.run, load, release]);
  useEffect(() => {
    const hide = () => {
      task.cancel();
      clear();
    };
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, [task.cancel, clear]);
  useEffect(() => {
    if (!pending) return;
    deadline.current = setTimeout(
      () => {
        task.cancel();
        clear();
        void task.run(async (signal) => {
          await load(signal);
          throw new Error('PREPARATION_EXPIRED');
        });
      },
      Math.max(0, Date.parse(pending.prep.expiresAt) - Date.now())
    );
    return () => clearTimeout(deadline.current);
  }, [pending, clear, load, task.cancel, task.run]);
  const create = () =>
    task.run(async (signal) => {
      if (!list) return;
      setDone(false);
      const generated = await generateOrganisationKey();
      signal.throwIfAborted();
      let prep: Activation;
      try {
        prep = await requestOperation('prepareKey', {
          body: { publicKey: generated.publicKey, expectedActiveKeyId: list.activeKeyId },
          signal,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'KEY_VERSION_CHANGED') await load(signal);
        throw error;
      }
      const id = {
        tenantId,
        keyId: prep.keyId,
        version: prep.version,
        publicKey: generated.publicKey,
        fingerprint: prep.fingerprint,
      };
      const file = await createOrganisationKeyFile(generated, id),
        key = await importOrganisationKey(new Blob([file]), id);
      signal.throwIfAborted();
      custody.current = { key, file };
      setPending({ prep, id, previous: list.activeKeyId });
    });
  const activate = () =>
    task.run(async (signal) => {
      let command = submission;
      if (!command) {
        if (!pending || !saved || !exported || !custody.current) return;
        const proof = await activationProof(
          custody.current.key,
          pending.id,
          pending.prep,
          actor,
          pending.previous
        );
        signal.throwIfAborted();
        if (Date.now() >= Date.parse(pending.prep.expiresAt)) {
          clear();
          throw new Error('PREPARATION_EXPIRED');
        }
        command = {
          preparationId: pending.prep.preparationId,
          keyId: pending.id.keyId,
          body: { proof, savedConfirmation: true },
        };
        setSubmission(command);
        clear();
      }
      try {
        const receipt = await requestOperation('activate', {
          id: command.preparationId,
          body: command.body,
          signal,
        });
        if (receipt.keyId !== command.keyId || receipt.state === 'prepared')
          throw new Error('RECORDING_UNAVAILABLE');
      } catch (error) {
        signal.throwIfAborted();
        const terminal =
          error instanceof Error &&
          [
            'KEY_VERSION_CHANGED',
            'PREPARATION_EXPIRED',
            'PREPARATION_NOT_FOUND',
            'PREPARATION_USED',
            'PERMISSION_REQUIRED',
            'AUTHENTICATION_REQUIRED',
            'INVALID_PROOF',
          ].includes(error.message);
        if (terminal) setSubmission(null);
        const history = await load(signal);
        if (
          history.keys.some(
            (key) =>
              key.keyId === command.keyId && (key.state === 'active' || key.state === 'superseded')
          )
        ) {
          setSubmission(null);
          setDone(true);
          return;
        }
        throw error;
      }
      signal.throwIfAborted();
      setSubmission(null);
      setDone(true);
      await load(signal);
    });
  const download = () => {
    if (!pending || !custody.current) return;
    release();
    link.current = URL.createObjectURL(
      new Blob([custody.current.file], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = link.current;
    a.download = 'ssf-organisation-key-' + pending.id.keyId + '.json';
    a.click();
    setExported(true);
  };
  const print = () => {
    if (!pending || !custody.current) return;
    release();
    const sheet = document.createElement('iframe');
    sheet.title = pt('keys.print');
    sheet.className = 'sr-only';
    document.body.appendChild(sheet);
    frame.current = sheet;
    const doc = sheet.contentDocument,
      win = sheet.contentWindow;
    if (!doc || !win) {
      release();
      return;
    }
    doc.title = pt('keys.print');
    const notice = doc.createElement('p');
    notice.textContent = pt('keys.printNotice');
    const data = doc.createElement('p');
    data.style.overflowWrap = 'anywhere';
    data.textContent = b64(new TextEncoder().encode(custody.current.file));
    doc.body.replaceChildren(notice, data);
    win.addEventListener('afterprint', release, { once: true });
    win.focus();
    win.print();
    setExported(true);
  };
  return (
    <StudioOverviewPageTemplate
      title={pt('administration.pages.organisation-keys')}
      description={pt('keys.replaceNotice')}
    >
      <RecordingError code={task.error} />
      {done && <StudioFormSummary kind="success">{pt('keys.activated')}</StudioFormSummary>}
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
          <Button
            disabled={task.busy}
            onClick={() =>
              void task.run(async (signal) => {
                await load(signal);
              })
            }
          >
            {pt(task.busy ? 'status.loading' : 'keys.reload')}
          </Button>
        )}
      </StudioSection>
      {submission && (
        <StudioSection title={pt('keys.confirmedStatus')}>
          <p>{submission.preparationId}</p>
          <Button disabled={task.busy} onClick={() => void activate()}>
            {pt('keys.retryConfirmed')}
          </Button>
        </StudioSection>
      )}
      {pending && (
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
      )}
    </StudioOverviewPageTemplate>
  );
};
export const SsfOrganisationKeysPage = () => (
  <RecordingContext form={OrganisationKeyForm} permission="ssf.configuration.tenant.manage" />
);
