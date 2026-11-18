import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestOperation } from './organisation-key-client.js';
import {
  activationProof,
  createOrganisationKeyFile,
  generateOrganisationKey,
  importOrganisationKey,
} from './organisation-key-crypto.js';
import type { Activation, KeyIdentity } from './organisation-key-contracts.js';
import { useRecordingTask, type RecordingActor } from './admin.recording-key-session.js';
import { useOrganisationKeyCustody } from './admin.organisation-key-custody.js';

type History = Awaited<ReturnType<typeof requestOperation<'list'>>>;
type Load = (signal: AbortSignal) => Promise<History>;
type Task = ReturnType<typeof useRecordingTask>;
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

async function createDraft(
  tenantId: string,
  previous: string | null,
  load: Load,
  signal: AbortSignal
) {
  const generated = await generateOrganisationKey();
  signal.throwIfAborted();
  let prep: Activation;
  try {
    prep = await requestOperation('prepareKey', {
      body: { publicKey: generated.publicKey, expectedActiveKeyId: previous },
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
  const file = await createOrganisationKeyFile(generated, id);
  const key = await importOrganisationKey(new Blob([file]), id);
  return { pending: { prep, id, previous }, custody: { key, file } };
}

function usePreparationLifetime(
  task: Task,
  load: Load,
  pending: Pending | null,
  clear: () => void,
  deadline: React.RefObject<ReturnType<typeof setTimeout> | undefined>
) {
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
}

function useKeyPreparation(task: Task, load: Load) {
  const local = useOrganisationKeyCustody();
  const [pending, setPending] = useState<Pending | null>(null);
  const [saved, setSaved] = useState(false),
    [exported, setExported] = useState(false);
  const exportButton = useRef<HTMLButtonElement>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearCustody = local.clear;
  const clear = useCallback(() => {
    clearTimeout(deadline.current);
    clearCustody();
    setPending(null);
    setSaved(false);
    setExported(false);
  }, [clearCustody]);
  useEffect(() => {
    if (pending) exportButton.current?.focus();
  }, [pending]);
  useEffect(() => {
    void task.run(async (signal) => {
      await load(signal);
    });
    return clearCustody;
  }, [task.run, load, clearCustody]);
  usePreparationLifetime(task, load, pending, clear, deadline);
  const start = async (tenantId: string, previous: string | null, signal: AbortSignal) => {
    const draft = await createDraft(tenantId, previous, load, signal);
    signal.throwIfAborted();
    local.custody.current = draft.custody;
    setPending(draft.pending);
  };
  const confirm = async (
    actor: string,
    signal: AbortSignal
  ): Promise<ActivationSubmission | null> => {
    if (!pending || !saved || !exported || !local.custody.current) return null;
    const proof = await activationProof(
      local.custody.current.key,
      pending.id,
      pending.prep,
      actor,
      pending.previous
    );
    signal.throwIfAborted();
    return {
      preparationId: pending.prep.preparationId,
      keyId: pending.id.keyId,
      body: { proof, savedConfirmation: true },
    };
  };
  return {
    pending,
    saved,
    setSaved,
    exported,
    exportButton,
    clear,
    start,
    confirm,
    download: () => {
      if (pending && local.download(pending.id.keyId)) setExported(true);
    },
    print: () => {
      if (pending && local.print()) setExported(true);
    },
  };
}

const terminalErrors = [
  'KEY_VERSION_CHANGED',
  'PREPARATION_EXPIRED',
  'PREPARATION_NOT_FOUND',
  'PREPARATION_USED',
  'PERMISSION_REQUIRED',
  'AUTHENTICATION_REQUIRED',
  'INVALID_PROOF',
];
async function sendActivation(
  command: ActivationSubmission,
  load: Load,
  clearSubmission: () => void,
  signal: AbortSignal
) {
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
    if (error instanceof Error && terminalErrors.includes(error.message)) clearSubmission();
    const history = await load(signal);
    if (
      history.keys.some(
        (k) => k.keyId === command.keyId && (k.state === 'active' || k.state === 'superseded')
      )
    )
      return 'reconciled';
    throw error;
  }
  return 'activated';
}

export function useOrganisationKeyEditor({ tenantId, actor }: RecordingActor) {
  const task = useRecordingTask();
  const [list, setList] = useState<History | null>(null);
  const [submission, setSubmission] = useState<ActivationSubmission | null>(null);
  const [done, setDone] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => {
    setList(null);
    const history = await requestOperation('list', { signal });
    signal.throwIfAborted();
    setList(history);
    return history;
  }, []);
  const { start, confirm, clear, ...draft } = useKeyPreparation(task, load);
  const cancel = () => {
    if (submission) return;
    task.cancel();
    clear();
    if (draft.pending)
      void requestOperation('abandon', { id: draft.pending.prep.preparationId }).catch(
        () => undefined
      );
  };
  useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: !!draft.pending || !!submission,
    onDiscard: cancel,
  });
  const create = () =>
    task.run(async (signal) => {
      if (!list) return;
      setDone(false);
      await start(tenantId, list.activeKeyId, signal);
    });
  const activate = () =>
    task.run(async (signal) => {
      let command = submission;
      if (!command) {
        command = await confirm(actor, signal);
        signal.throwIfAborted();
        if (!command || !draft.pending) return;
        if (Date.now() >= Date.parse(draft.pending.prep.expiresAt)) {
          clear();
          throw new Error('PREPARATION_EXPIRED');
        }
        setSubmission(command);
        clear();
      }
      const outcome = await sendActivation(command, load, () => setSubmission(null), signal);
      signal.throwIfAborted();
      setSubmission(null);
      setDone(true);
      if (outcome === 'activated') await load(signal);
    });
  const reload = () =>
    task.run(async (signal) => {
      await load(signal);
    });
  return { task, list, submission, done, ...draft, cancel, create, activate, reload };
}
export type OrganisationKeyEditor = ReturnType<typeof useOrganisationKeyEditor>;
