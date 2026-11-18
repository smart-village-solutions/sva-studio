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
  key: CryptoKey;
  file: string;
  previous: string | null;
}
export const OrganisationKeyForm = ({ tenantId, actor }: RecordingActor) => {
  const pt = usePluginTranslation('ssf'),
    task = useRecordingTask();
  const [list, setList] = useState<{ keys: OrganisationKey[]; activeKeyId: string | null } | null>(
      null
    ),
    [pending, setPending] = useState<Pending | null>(null),
    [saved, setSaved] = useState(false),
    [exported, setExported] = useState(false),
    [done, setDone] = useState(false);
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
    release();
    setPending(null);
    setSaved(false);
    setExported(false);
  }, [release]);
  const cancel = () => {
    task.cancel();
    clear();
    if (pending)
      void requestOperation('abandon', { id: pending.prep.preparationId }).catch(() => undefined);
  };
  useStudioEditorLeaveGuard({ enabled: true, hasUnsavedChanges: !!pending, onDiscard: cancel });
  const load = useCallback(async (signal: AbortSignal) => {
    setList(null);
    const result = await requestOperation('list', { signal });
    signal.throwIfAborted();
    setList(result);
  }, []);
  useEffect(() => {
    void task.run(load);
    return release;
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
    const timer = setTimeout(
      () => {
        task.cancel();
        clear();
        void task.run(async () => {
          throw new Error('PREPARATION_EXPIRED');
        });
      },
      Math.max(0, Date.parse(pending.prep.expiresAt) - Date.now())
    );
    return () => clearTimeout(timer);
  }, [pending, clear, task.cancel, task.run]);
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
      setPending({ prep, id, key, file, previous: list.activeKeyId });
    });
  const activate = () =>
    task.run(async (signal) => {
      if (!exported || !saved || !pending) return;
      const proof = await activationProof(
        pending.key,
        pending.id,
        pending.prep,
        actor,
        pending.previous
      );
      signal.throwIfAborted();
      try {
        await requestOperation('activate', {
          id: pending.prep.preparationId,
          body: { proof, savedConfirmation: true },
          signal,
        });
      } catch (e) {
        signal.throwIfAborted();
        if (
          e instanceof Error &&
          [
            'KEY_VERSION_CHANGED',
            'PREPARATION_EXPIRED',
            'PREPARATION_USED',
            'PERMISSION_REQUIRED',
            'STEP_UP_REQUIRED',
            'INVALID_PROOF',
          ].includes(e.message)
        )
          clear();
        await load(signal);
        throw e;
      }
      signal.throwIfAborted();
      clear();
      setDone(true);
      await load(signal);
    });
  const download = () => {
    if (!pending) return;
    release();
    link.current = URL.createObjectURL(new Blob([pending.file], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = link.current;
    a.download = 'ssf-organisation-key-' + pending.id.keyId + '.json';
    a.click();
    setExported(true);
  };
  const print = () => {
    if (!pending) return;
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
    data.textContent = b64(new TextEncoder().encode(pending.file));
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
            {!pending && (
              <Button disabled={task.busy} onClick={() => void create()}>
                {pt(list.activeKeyId ? 'keys.replace' : 'keys.create')}
              </Button>
            )}
          </>
        ) : (
          <Button disabled={task.busy} onClick={() => void task.run(load)}>
            {pt(task.busy ? 'status.loading' : 'keys.reload')}
          </Button>
        )}
      </StudioSection>
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
