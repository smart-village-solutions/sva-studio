import type { MainserverActingPrincipalType } from '@sva/plugin-sdk';
import { jobInputSchema, type JobInput } from './contract.js';
import { jobRejection, jobRequestHash, saveJob, removeJob, type JobPending } from './jobs.api.js';
import { useEditorData, useEditorLoads, type JobEditorData } from './jobs.editor-data.js';

function rejectionMessage(code: string): string {
  return (code.startsWith('job_') && code !== 'job_prewrite_failed') ||
    code === 'forbidden' ||
    code === 'stale_mainserver_context'
    ? `errors.${code}`
    : 'messages.saveError';
}
function useEditorCommit({
  key,
  setBusy,
  setFailure,
  guard,
  draft,
  record,
  principal,
  setRecord,
  setMessage,
  setPending,
  setDraft,
  setBaseline,
  setDeleted,
}: JobEditorData) {
  return async (operation: JobPending, recover: boolean, revision = guard.captureRevision()) => {
    setBusy(true);
    setFailure(undefined);
    try {
      if (operation.kind === 'delete') {
        if (!operation.id) throw new Error('job_outcome_unknown');
        const result = await removeJob(
          operation.id,
          recover
            ? { recover: true, inputHash: operation.inputHash }
            : { baseFingerprint: record!.contentFingerprint },
          principal,
          operation.operationId
        );
        setDeleted(true);
        if (result.reconciliationRequired) {
          setMessage('messages.deletePartial');
          return;
        }
        sessionStorage.removeItem(key);
        setPending(undefined);
        setBaseline(JSON.stringify(draft));
        guard.acknowledgeSaved(revision);
        setMessage('messages.deleted');
        return;
      }
      const result = await saveJob(
        operation.id,
        recover
          ? { recover: true, inputHash: operation.inputHash }
          : { job: draft, ...(record ? { baseFingerprint: record.contentFingerprint } : {}) },
        principal,
        operation.operationId
      );
      setRecord(result);
      if (result.reconciliationRequired) {
        setMessage('messages.partial');
        return;
      }
      sessionStorage.removeItem(key);
      setPending(undefined);
      if (guard.acknowledgeSaved(revision)) {
        setDraft(result.input);
        setBaseline(JSON.stringify(result.input));
      }
      setMessage('messages.saved');
    } catch (error) {
      const code = jobRejection(error);
      if (code && !recover) {
        sessionStorage.removeItem(key);
        setPending(undefined);
        setFailure(rejectionMessage(code));
      } else
        setFailure(operation.kind === 'delete' ? 'messages.deleteUnknown' : 'messages.unknown');
    } finally {
      setBusy(false);
    }
  };
}
function useEditorRemove(data: JobEditorData, commit: ReturnType<typeof useEditorCommit>) {
  const { record, saving, setPending, setFailure, key } = data;
  return async () => {
    if (
      !record ||
      data.deleted ||
      data.pending ||
      data.busy ||
      saving.current ||
      !data.access.canDelete
    )
      return;
    saving.current = true;
    data.setBusy(true);
    try {
      const body = { baseFingerprint: record.contentFingerprint };
      const operation: JobPending = {
        operationId: crypto.randomUUID(),
        inputHash: await jobRequestHash(body),
        id: record.id,
        kind: 'delete',
      };
      sessionStorage.setItem(key, JSON.stringify(operation));
      setPending(operation);
      await commit(operation, false);
    } catch {
      setFailure('messages.saveError');
    } finally {
      saving.current = false;
      data.setBusy(false);
    }
  };
}
export function useJobEditor(
  id: string | undefined,
  scope: string,
  initialPrincipal: MainserverActingPrincipalType = 'user'
) {
  const data = useEditorData(id, scope, initialPrincipal);
  useEditorLoads(data);
  const {
    guard,
    setDraft,
    setMessage,
    saving,
    draft,
    record,
    key,
    setPending,
    setErrors,
    setFailure,
  } = data;
  const commit = useEditorCommit(data);
  const removeDraft = useEditorRemove(data, commit);
  const change = <K extends keyof JobInput>(field: K, value: JobInput[K]) => {
    guard.markChanged();
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage(undefined);
  };
  const save = async () => {
    if (saving.current || data.deleted || data.busy || data.pending || (id && !record)) return;
    const parsed = jobInputSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.path.join('.')));
      return;
    }
    setErrors([]);
    saving.current = true;
    data.setBusy(true);
    const revision = guard.captureRevision();
    try {
      const body = {
        job: draft,
        ...(record ? { baseFingerprint: record.contentFingerprint } : {}),
      };
      const operation = {
        operationId: crypto.randomUUID(),
        inputHash: await jobRequestHash(body),
        ...(record ? { id: record.id } : {}),
      };
      sessionStorage.setItem(key, JSON.stringify(operation));
      setPending(operation);
      await commit(operation, false, revision);
    } catch {
      setFailure('messages.saveError');
    } finally {
      saving.current = false;
      data.setBusy(false);
    }
  };
  return {
    ...data,
    change,
    save,
    remove: removeDraft,
    recover: () => (data.pending ? commit(data.pending, true) : Promise.resolve()),
  };
}
