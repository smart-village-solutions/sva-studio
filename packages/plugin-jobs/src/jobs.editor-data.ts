import { useEffect, useState, useRef } from 'react';
import { toDatetimeLocalValue, type MainserverActingPrincipalType } from '@sva/plugin-sdk';
import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import { createJobDefaults, type JobRecord } from './contract.js';
import { getJob, listJobCategories, readJobPending, type JobPending } from './jobs.api.js';
import { useJobAccess } from './jobs.access.js';

export function useEditorData(
  id: string | undefined,
  scope: string,
  initialPrincipal: MainserverActingPrincipalType
) {
  const principal = initialPrincipal;
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
export function useEditorLoads({
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

export type JobEditorData = ReturnType<typeof useEditorData>;
