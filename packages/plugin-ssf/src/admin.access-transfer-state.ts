import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecordingTask, type RecordingActor } from './admin.recording-key-session.js';
import { importOrganisationKey } from './organisation-key-crypto.js';
import { readPeople, requestOperation } from './organisation-key-client.js';
import type { Candidate, OrganisationKey } from './organisation-key-contracts.js';
import {
  confirmTransfer,
  groupTransferScope,
  prepareTransfer,
  readCandidates,
  sendTransfer,
  type ScopeMember,
  type TransferPreview,
  type TransferReceipt,
  type TransferSubmission,
} from './access-transfer-workflow.js';

type Task = ReturnType<typeof useRecordingTask>;
function useTransferDirectory(task: Task) {
  const [people, setPeople] = useState<Awaited<ReturnType<typeof readPeople>>>([]);
  const [orgs, setOrgs] = useState<OrganisationKey[]>([]);
  const load = useCallback(async (signal: AbortSignal) => {
    const [people, orgs] = await Promise.all([
      readPeople(signal),
      requestOperation('list', { signal }),
    ]);
    signal.throwIfAborted();
    setPeople(people);
    setOrgs(orgs.keys);
  }, []);
  useEffect(() => {
    void task.run(load);
  }, [task.run, load]);
  return {
    people,
    orgs,
    reload: () => task.run(load),
    label: (sub: string) => people.find((p) => p.sub === sub)?.displayName ?? sub,
  };
}

function useTransferPreview(task: Task) {
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [hasLocalKey, setHasLocalKey] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [fileEpoch, setFileEpoch] = useState(0);
  const localKey = useRef<CryptoKey | null>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const discard = useCallback(() => {
    clearTimeout(deadline.current);
    setPreview(null);
    localKey.current = null;
    setHasLocalKey(false);
    setConfirmed(false);
    setFileEpoch((n) => n + 1);
  }, []);
  useEffect(() => {
    if (preview) fileInput.current?.focus();
  }, [preview]);
  useEffect(() => {
    const hide = () => {
      task.cancel();
      discard();
    };
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, [task.cancel, discard]);
  useEffect(() => {
    if (!preview) return;
    deadline.current = setTimeout(
      () => {
        task.cancel();
        discard();
        void task.run(async () => {
          throw new Error('PREPARATION_EXPIRED');
        });
      },
      Math.max(0, Date.parse(preview.transfer.expiresAt) - Date.now())
    );
    return () => clearTimeout(deadline.current);
  }, [preview, task.run, task.cancel, discard]);
  const fileChanged = (file: File | undefined) => {
    localKey.current = null;
    setHasLocalKey(false);
    setConfirmed(false);
    if (file && preview)
      void task.run(async (signal) => {
        const key = await importOrganisationKey(file, preview.id);
        signal.throwIfAborted();
        localKey.current = key;
        setHasLocalKey(true);
      });
  };
  return {
    preview,
    setPreview,
    hasLocalKey,
    confirmed,
    setConfirmed,
    localKey,
    fileInput,
    fileEpoch,
    fileChanged,
    discard,
  };
}

function useCandidateSelection(task: Task, discard: () => void) {
  const [source, setSource] = useState(''),
    [target, setTarget] = useState(''),
    [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [items, setItems] = useState<Candidate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const reset = () => {
    task.cancel();
    discard();
    setSelected([]);
    setItems([]);
    setCursor(null);
  };
  const find = (next: string | null) =>
    task.run(async (signal) => {
      const page = await readCandidates(source, next, signal);
      signal.throwIfAborted();
      discard();
      if (!next) setSelected([]);
      setItems((previous) => [
        ...new Map(
          [...(next ? previous : []), ...page.items].map((c) => [c.conversationId, c])
        ).values(),
      ]);
      setCursor(page.nextCursor);
    });
  return {
    source,
    setSource,
    target,
    setTarget,
    reason,
    setReason,
    selected,
    setSelected,
    items,
    cursor,
    find,
    reset,
    groups: groupTransferScope(items, selected),
  };
}

const terminalErrors = [
  'KEY_VERSION_CHANGED',
  'SCOPE_CHANGED',
  'PREPARATION_NOT_FOUND',
  'PREPARATION_USED',
  'PREPARATION_EXPIRED',
  'PERMISSION_REQUIRED',
  'AUTHENTICATION_REQUIRED',
  'INVALID_PROOF',
];
export function useAccessTransferEditor({ tenantId, actor }: RecordingActor) {
  const task = useRecordingTask();
  const directory = useTransferDirectory(task);
  const { localKey, setPreview, ...proof } = useTransferPreview(task);
  const selection = useCandidateSelection(task, proof.discard);
  const [submission, setSubmission] = useState<TransferSubmission | null>(null);
  const [receipts, setReceipts] = useState<TransferReceipt[]>([]);
  const reset = () => {
    selection.reset();
    setReceipts([]);
  };
  useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: !!submission || !!proof.preview || selection.selected.length > 0,
    onDiscard: () => {
      if (!submission) reset();
    },
  });
  const prepare = (id: string, members: ScopeMember[]) =>
    task.run(async (signal) => {
      proof.discard();
      const preview = await prepareTransfer(
        tenantId,
        directory.orgs.find((org) => org.keyId === id),
        selection.target,
        selection.reason,
        members,
        signal
      );
      signal.throwIfAborted();
      setPreview(preview);
    });
  const commit = () =>
    task.run(async (signal) => {
      let command = submission;
      try {
        if (!command) {
          if (!proof.preview || !localKey.current || !proof.confirmed) return;
          command = await confirmTransfer(
            localKey.current,
            proof.preview,
            actor,
            selection.reason,
            signal
          );
          signal.throwIfAborted();
          if (Date.now() >= Date.parse(proof.preview.transfer.expiresAt))
            throw new Error('PREPARATION_EXPIRED');
          setSubmission(command);
          proof.discard();
        }
        const receipt = await sendTransfer(command, signal);
        signal.throwIfAborted();
        setReceipts((prev) => [...prev, receipt]);
        setSubmission(null);
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof Error && terminalErrors.includes(error.message)) {
          setSubmission(null);
          proof.discard();
        }
        throw error;
      }
    });
  return {
    task,
    ...directory,
    ...selection,
    ...proof,
    reset,
    submission,
    receipts,
    prepare,
    commit,
  };
}
export type AccessTransferEditor = ReturnType<typeof useAccessTransferEditor>;
