import { useEffect, useState, useRef } from 'react';
import { toDatetimeLocalValue, type MainserverActingPrincipalType } from '@sva/plugin-sdk';
import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import { createJobDefaults, jobInputSchema, type JobInput, type JobRecord } from './contract.js';
import {
  jobRejection,
  getJob,
  listJobCategories,
  readJobPending,
  jobRequestHash,
  saveJob,
  removeJob,
  type JobPending,
} from './jobs.api.js';
import { useJobAccess } from './jobs.access.js';

function useEditorData(
  id: string | undefined,
  scope: string,
  initialPrincipal: MainserverActingPrincipalType
) {
  const [principal, setPrincipal] = useState<MainserverActingPrincipalType>(initialPrincipal);
  const key = `jobs:${scope}:${principal}:${id ?? 'new'}`;
  const [record, setRecord] = useState<JobRecord>();
  const [draft, setDraft] = useState(() =>
    createJobDefaults(toDatetimeLocalValue(new Date().toISOString()).slice(0, 10))
  );
  const [baseline, setBaseline] = useState(JSON.stringify(draft));
  const [resourceAccess, setResourceAccess] = useState<Readonly<Record<string, boolean>>>({});
  const [deleted, setDeleted] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>();
  const [categoryError, setCategoryError] = useState(false);
  const [pending, setPending] = useState<JobPending | undefined>(() => readJobPending(key));
  const saving = useRef(false);
  const access = useJobAccess(resourceAccess);
  const dirty = baseline !== JSON.stringify(draft);
  const guard = useStudioEditorLeaveGuard({
    enabled: !deleted,
    hasUnsavedChanges: dirty || Boolean(pending),
  });
  return {
    id,
    deleted,
    setDeleted,
    principal,
    setPrincipal,
    key,
    record,
    setRecord,
    draft,
    setDraft,
    setBaseline,
    resourceAccess,
    setResourceAccess,
    loading,
    setLoading,
    busy,
    setBusy,
    failure,
    setFailure,
    message,
    setMessage,
    errors,
    setErrors,
    categories: categories ?? [],
    setCategories,
    categoryError,
    setCategoryError,
    categoriesLoading: categories === undefined && !categoryError,
    pending,
    setPending,
    saving,
    access,
    dirty,
    guard,
  };
}
function useEditorLoads({
  id,
  principal,
  key,
  setPending,
  setCategories,
  setCategoryError,
  setLoading,
  setRecord,
  setDraft,
  setBaseline,
  setResourceAccess,
  setFailure,
}: ReturnType<typeof useEditorData>) {
  useEffect(() => {
    let active = true;
    setCategories(undefined);
    setCategoryError(false);
    void listJobCategories(principal).then(
      (items) => active && setCategories(items),
      () => active && setCategoryError(true)
    );
    return () => {
      active = false;
    };
  }, [principal, key]);
  useEffect(() => {
    setPending(readJobPending(key));
    if (!id) return;
    let active = true;
    setLoading(true);
    setRecord(undefined);
    setResourceAccess({});
    setFailure(undefined);
    void getJob(id, principal)
      .then(
        (result) => {
          if (!active) return;
          setRecord(result.data);
          setDraft(result.data.input);
          setBaseline(JSON.stringify(result.data.input));
          setResourceAccess(result.access);
        },
        () => active && setFailure('messages.loadError')
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, principal, key]);
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
}: ReturnType<typeof useEditorData>) {
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
        setFailure(
          (code.startsWith('job_') && code !== 'job_prewrite_failed') ||
            code === 'forbidden' ||
            code === 'stale_mainserver_context'
            ? `errors.${code}`
            : 'messages.saveError'
        );
      } else
        setFailure(operation.kind === 'delete' ? 'messages.deleteUnknown' : 'messages.unknown');
    } finally {
      setBusy(false);
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
    remove: async () => {
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
    },
    recover: () => (data.pending ? commit(data.pending, true) : Promise.resolve()),
  };
}
