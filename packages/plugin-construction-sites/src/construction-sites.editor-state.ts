import { useEffect, useState, useRef } from 'react';
import { toDatetimeLocalValue, type MainserverActingPrincipalType } from '@sva/plugin-sdk';
import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import {
  createConstructionSiteDefaults,
  constructionSiteInputSchema,
  type ConstructionSiteInput,
  type ConstructionSiteRecord,
} from './contract.js';
import {
  constructionSiteRejection,
  getConstructionSite,
  listConstructionSiteCategories,
  readConstructionSitePending,
  constructionSiteRequestHash,
  saveConstructionSite,
  type ConstructionSitePending,
} from './construction-sites.api.js';
import { useConstructionSiteAccess } from './construction-sites.access.js';

function useEditorData(
  id: string | undefined,
  scope: string,
  initialPrincipal: MainserverActingPrincipalType
) {
  const [principal, setPrincipal] = useState<MainserverActingPrincipalType>(initialPrincipal);
  const key = `construction-sites:${scope}:${principal}:${id ?? 'new'}`;
  const [record, setRecord] = useState<ConstructionSiteRecord>();
  const [draft, setDraft] = useState(() =>
    createConstructionSiteDefaults(toDatetimeLocalValue(new Date().toISOString()).slice(0, 10))
  );
  const [baseline, setBaseline] = useState(JSON.stringify(draft));
  const [resourceAccess, setResourceAccess] = useState<Readonly<Record<string, boolean>>>({});
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [pending, setPending] = useState<ConstructionSitePending | undefined>(() =>
    readConstructionSitePending(key)
  );
  const saving = useRef(false);
  const access = useConstructionSiteAccess(resourceAccess);
  const dirty = baseline !== JSON.stringify(draft);
  const guard = useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: dirty || Boolean(pending),
  });
  const data = {
    id,
    principal,
    setPrincipal,
    key,
    record,
    setRecord,
    draft,
    setDraft,
    baseline,
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
    categories,
    setCategories,
    categoryError,
    setCategoryError,
    pending,
    setPending,
    saving,
    access,
    dirty,
    guard,
  };
  return data;
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
    void listConstructionSiteCategories().then(
      (items) => active && setCategories(items),
      () => active && setCategoryError(true)
    );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setPending(readConstructionSitePending(key));
    if (!id) return;
    let active = true;
    setLoading(true);
    void getConstructionSite(id, principal)
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
}: ReturnType<typeof useEditorData>) {
  const commit = async (
    operation: ConstructionSitePending,
    recover: boolean,
    revision = guard.captureRevision()
  ) => {
    setBusy(true);
    setFailure(undefined);
    try {
      const result = await saveConstructionSite(
        operation.id,
        recover
          ? { recover: true, inputHash: operation.inputHash }
          : { site: draft, ...(record ? { baseFingerprint: record.contentFingerprint } : {}) },
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
      const code = constructionSiteRejection(error);
      if (code && !recover) {
        sessionStorage.removeItem(key);
        setPending(undefined);
        setFailure(
          code === 'construction_site_content_conflict'
            ? `errors.${code}`
            : code === 'forbidden' || code === 'stale_mainserver_context'
              ? `errors.${code}`
              : 'messages.saveError'
        );
      } else setFailure('messages.unknown');
    } finally {
      setBusy(false);
    }
  };
  return commit;
}
export function useConstructionSiteEditor(
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
    busy,
    pending,
    draft,
    record,
    key,
    setPending,
    setErrors,
    setFailure,
  } = data;
  const commit = useEditorCommit(data);
  const change = <K extends keyof ConstructionSiteInput>(
    field: K,
    value: ConstructionSiteInput[K]
  ) => {
    guard.markChanged();
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage(undefined);
  };
  const save = async () => {
    if (saving.current || busy || pending || (id && !record)) return;
    const parsed = constructionSiteInputSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.path.join('.')));
      return;
    }
    setErrors([]);
    saving.current = true;
    const revision = guard.captureRevision();
    try {
      const body = {
        site: draft,
        ...(record ? { baseFingerprint: record.contentFingerprint } : {}),
      };
      const operation = {
        operationId: crypto.randomUUID(),
        inputHash: await constructionSiteRequestHash(body),
        ...(record ? { id: record.id } : {}),
      };
      sessionStorage.setItem(key, JSON.stringify(operation));
      setPending(operation);
      await commit(operation, false, revision);
    } catch {
      setFailure('messages.saveError');
    } finally {
      saving.current = false;
    }
  };
  return {
    ...data,
    change,
    save,
    recover: () => (pending ? commit(pending, true) : Promise.resolve()),
  };
}
