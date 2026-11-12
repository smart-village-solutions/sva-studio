/** Root draft lifecycle and atomic persistence over installation content and runtime template. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useStudioEditorLeaveGuard, useStudioEditorSuspended } from '@sva/studio-ui-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { focusSsfInvalidField } from './admin.content-v2-field-control.js';
import { editableSystemContent } from './admin.content-v2-fields.js';
import {
  readSsfSystemContentV2,
  writeSsfSystemContentV2,
  SsfContentConflictError,
  SsfRecordingPolicyConflictError,
} from './admin-api.js';
import {
  ssfInstallationContentV2FieldsSchema,
  ssfRuntimeContentV2FieldsSchema,
} from './content-v2-contracts.js';
import type { SsfSystemContentV2View } from './content-v2-admin-contracts.js';
import type { SsfVersionedContent, SsfSystemEditorPage } from './content-v2-editor-contracts.js';
type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved' | 'invalid' | 'conflict';
type Draft = ReturnType<typeof editableSystemContent>;
type Page = SsfSystemEditorPage | 'installation-overview';
const systemChanges = (draft: Draft, baseline: Draft, page: Page) => {
  const installation =
    page === 'default-content' &&
    JSON.stringify(draft.installation) !== JSON.stringify(baseline.installation)
      ? draft.installation
      : null;
  const runtimeTemplate =
    JSON.stringify(draft.runtimeTemplate) !== JSON.stringify(baseline.runtimeTemplate)
      ? draft.runtimeTemplate
      : null;
  return { installation, runtimeTemplate };
};
const validateSystemChanges = ({
  installation,
  runtimeTemplate,
}: ReturnType<typeof systemChanges>) => {
  const parsedInstallation = installation
    ? ssfInstallationContentV2FieldsSchema.safeParse(installation)
    : null;
  const parsedRuntime = runtimeTemplate
    ? ssfRuntimeContentV2FieldsSchema.safeParse(runtimeTemplate)
    : null;
  return [
    ...(parsedInstallation && !parsedInstallation.success
      ? parsedInstallation.error.issues.map((issue) => ({
          ...issue,
          path: ['installation', ...issue.path],
        }))
      : []),
    ...(parsedRuntime && !parsedRuntime.success
      ? parsedRuntime.error.issues.map((issue) => ({
          ...issue,
          path: ['runtimeTemplate', ...issue.path],
        }))
      : []),
  ];
};
const useSystemState = () => {
  const [saved, setSaved] = useState<SsfVersionedContent<SsfSystemContentV2View> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [tab, setTab] = useState('installation');
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [affectedTenants, setAffectedTenants] = useState<readonly string[]>([]);
  const saving = useRef(false);
  const accept = (
    next: SsfVersionedContent<SsfSystemContentV2View>,
    editable = editableSystemContent(next)
  ) => {
    setSaved(next);
    setDraft(editable);
    setBaseline(editable);
    setErrors({});
    setAffectedTenants([]);
  };
  const load = useCallback(async (canAccept?: () => boolean) => {
    setStatus('loading');
    try {
      const next = await readSsfSystemContentV2();
      const editable = editableSystemContent(next);
      if (canAccept && !canAccept()) {
        setStatus('conflict');
        return false;
      }
      accept(next, editable);
      setStatus('ready');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const discard = () => {
    setDraft(baseline);
    setErrors({});
    setAffectedTenants([]);
    setStatus('ready');
    setEpoch((value) => value + 1);
  };
  return {
    saved,
    draft,
    baseline,
    epoch,
    tab,
    status,
    errors,
    affectedTenants,
    saving,
    accept,
    load,
    discard,
    setStatus,
    setErrors,
    setAffectedTenants,
    setTab,
    setDraft,
  };
};
type SystemState = ReturnType<typeof useSystemState>;
const saveSystem = async (
  state: SystemState,
  page: Page,
  suspended: boolean,
  guard: ReturnType<typeof useStudioEditorLeaveGuard>,
  pt: ReturnType<typeof usePluginTranslation>
): Promise<boolean> => {
  const {
    draft,
    baseline,
    saved,
    saving,
    setStatus,
    setErrors,
    setAffectedTenants,
    setTab,
    accept,
  } = state;
  if (
    !draft ||
    !baseline ||
    !saved ||
    suspended ||
    saving.current ||
    page === 'installation-overview'
  )
    return false;
  saving.current = true;
  const revision = guard.captureRevision();
  setStatus('saving');
  setErrors({});
  setAffectedTenants([]);
  try {
    const { installation, runtimeTemplate } = systemChanges(draft, baseline, page);
    const issues = validateSystemChanges({ installation, runtimeTemplate });
    if (issues.length) {
      setErrors(
        Object.fromEntries(issues.map((issue) => [issue.path.join('.'), pt('v2.invalid')]))
      );
      if (page === 'default-content')
        setTab(issues[0]!.path[0] === 'installation' ? 'installation' : 'runtimeTemplate');
      setStatus('invalid');
      return false;
    }
    const next = await writeSsfSystemContentV2(
      { installation, runtimeTemplate },
      saved.contentRevision
    );
    if (!guard.acknowledgeSaved(revision)) {
      setStatus('conflict');
      return false;
    }
    accept(next);
    setStatus('saved');
    return true;
  } catch (error) {
    if (error instanceof SsfRecordingPolicyConflictError) setAffectedTenants(error.affectedTenants);
    setStatus(error instanceof SsfContentConflictError ? 'conflict' : 'error');
    return false;
  } finally {
    saving.current = false;
  }
};
export const useSsfSystemEditor = (page: Page) => {
  const state = useSystemState();
  const { draft, baseline, errors, status } = state;
  const pt = usePluginTranslation('ssf');
  const suspended = useStudioEditorSuspended();
  const formRef = useRef<HTMLDivElement>(null);
  const save = () => saveSystem(state, page, suspended, guard, pt);
  const discard = () => {
    state.discard();
    guard.acknowledgeSaved(guard.captureRevision());
  };
  const load = () => {
    const revision = guard.captureRevision();
    return state.load(() => guard.acknowledgeSaved(revision));
  };
  const guard = useStudioEditorLeaveGuard({
    enabled: page !== 'installation-overview',
    hasUnsavedChanges: JSON.stringify(draft) !== JSON.stringify(baseline),
    onSave: save,
    onDiscard: discard,
  });
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    const timer = setTimeout(() => focusSsfInvalidField(formRef.current, errors), 0);
    return () => clearTimeout(timer);
  }, [errors]);
  const fieldErrors = useMemo(() => {
    const inScope = (scope: 'installation' | 'runtimeTemplate') =>
      Object.fromEntries(
        Object.entries(errors)
          .filter(([key]) => key.startsWith(`${scope}.`))
          .map(([key, value]) => [key.slice(scope.length + 1), value])
      );
    return { installation: inScope('installation'), runtimeTemplate: inScope('runtimeTemplate') };
  }, [errors]);
  return {
    ...state,
    discard,
    load,
    formRef,
    save,
    guard,
    fieldErrors,
    disabled: suspended || status === 'saving',
  };
};
