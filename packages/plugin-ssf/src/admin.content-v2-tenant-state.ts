/** Tenant draft lifecycle; page projections and revision acknowledgements stay on the existing save path. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useStudioEditorLeaveGuard, useStudioEditorSuspended } from '@sva/studio-ui-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readSsfTenantContentV2,
  writeSsfTenantContentV2,
  SsfContentConflictError,
} from './admin-api.js';
import { focusSsfInvalidField, type SsfV2EditorProps } from './admin.content-v2-field-control.js';
import type { SsfTenantContentV2View } from './content-v2-admin-contracts.js';
import type { SsfVersionedContent, SsfTenantEditorPage } from './content-v2-editor-contracts.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
import { ssfRecordingSettingsSchema } from './content-v2-recording.js';
import { effectiveSsfRuntimeFieldsV2 } from './content-v2-overrides.js';
import { projectSsfTenantPageOverrides } from './content-v2-page-overrides.js';
type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved' | 'invalid' | 'conflict';
const draftFromView = (view: SsfTenantContentV2View): SsfRuntimeContentV2Fields | null => {
  if (!view.runtimeTemplate) return null;
  const fields = effectiveSsfRuntimeFieldsV2(view.runtimeTemplate, view.overrides);
  const overrides = ssfRecordingSettingsSchema.parse(view.overrides?.['recording'] ?? {});
  if (view.runtimeTemplate.recording || view.overrides?.['recording'])
    return {
      ...fields,
      recording: {
        ...view.runtimeTemplate.recording,
        ...overrides,
        enabled: overrides.enabled ?? false,
        retentionHours: overrides.retentionHours ?? null,
      },
    };
  return fields;
};

const useTenantState = () => {
  const [saved, setSaved] = useState<SsfVersionedContent<SsfTenantContentV2View> | null>(null);
  const [baseline, setBaseline] = useState<SsfRuntimeContentV2Fields | null>(null);
  const [draft, setDraft] = useState<SsfRuntimeContentV2Fields | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const mediaResets = useRef<readonly string[][]>([]);
  const accept = (
    next: SsfVersionedContent<SsfTenantContentV2View>,
    value = draftFromView(next)
  ) => {
    mediaResets.current = [];
    setSaved(next);
    setDraft(value);
    setBaseline(value);
    setErrors({});
  };
  const load = useCallback(async (canAccept?: () => boolean) => {
    setStatus('loading');
    try {
      const next = await readSsfTenantContentV2();
      const value = draftFromView(next);
      if (canAccept && !canAccept()) {
        setStatus('conflict');
        return false;
      }
      accept(next, value);
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
    mediaResets.current = [];
    setDraft(baseline);
    setErrors({});
    setStatus('ready');
    setEpoch((value) => value + 1);
  };
  return {
    saved,
    baseline,
    draft,
    epoch,
    status,
    errors,
    savingRef,
    mediaResets,
    accept,
    load,
    discard,
    setStatus,
    setErrors,
    setDraft,
  };
};
type TenantState = ReturnType<typeof useTenantState>;
const saveTenant = async (
  state: TenantState,
  page: SsfTenantEditorPage | 'overview',
  canManage: boolean,
  suspended: boolean,
  guard: ReturnType<typeof useStudioEditorLeaveGuard>,
  pt: ReturnType<typeof usePluginTranslation>
): Promise<boolean> => {
  const { saved, baseline, draft, savingRef, mediaResets, setStatus, setErrors, accept } = state;
  if (
    !saved?.runtimeTemplate ||
    !baseline ||
    !draft ||
    !canManage ||
    suspended ||
    savingRef.current ||
    page === 'overview'
  )
    return false;
  savingRef.current = true;
  const revision = guard.captureRevision();
  setStatus('saving');
  setErrors({});
  try {
    const overrides = projectSsfTenantPageOverrides(
      page,
      saved.runtimeTemplate,
      saved.overrides,
      baseline,
      draft,
      mediaResets.current
    );
    effectiveSsfRuntimeFieldsV2(saved.runtimeTemplate, overrides);
    const next = await writeSsfTenantContentV2(overrides, saved.contentRevision);
    if (!guard.acknowledgeSaved(revision)) {
      setStatus('conflict');
      return false;
    }
    accept(next);
    setStatus('saved');
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      const issues = (error as { issues: { path: PropertyKey[] }[] }).issues;
      setErrors(
        Object.fromEntries(issues.map((issue) => [issue.path.join('.'), pt('v2.invalid')]))
      );
      setStatus('invalid');
    } else setStatus(error instanceof SsfContentConflictError ? 'conflict' : 'error');
    return false;
  } finally {
    savingRef.current = false;
  }
};
export const useSsfTenantEditor = (page: SsfTenantEditorPage | 'overview', canManage: boolean) => {
  const state = useTenantState();
  const { draft, baseline, mediaResets, errors, setDraft, status } = state;
  const suspended = useStudioEditorSuspended();
  const pt = usePluginTranslation('ssf');
  const formRef = useRef<HTMLDivElement>(null);
  const save = () => saveTenant(state, page, canManage, suspended, guard, pt);
  const discard = () => {
    state.discard();
    guard.acknowledgeSaved(guard.captureRevision());
  };
  const load = () => {
    const revision = guard.captureRevision();
    return state.load(() => guard.acknowledgeSaved(revision));
  };
  const dirty =
    mediaResets.current.length > 0 || JSON.stringify(draft) !== JSON.stringify(baseline);
  const guard = useStudioEditorLeaveGuard({
    enabled: canManage && page !== 'overview',
    hasUnsavedChanges: dirty,
    onSave: save,
    onDiscard: discard,
  });
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    const timer = setTimeout(() => focusSsfInvalidField(formRef.current, errors), 0);
    return () => clearTimeout(timer);
  }, [errors]);
  const change: SsfV2EditorProps<SsfRuntimeContentV2Fields>['onChange'] = (value, resetPath) => {
    if (resetPath?.[0] === 'branding' && typeof resetPath[1] === 'string') {
      mediaResets.current = [...mediaResets.current, ['branding', resetPath[1]]];
    } else if (
      resetPath?.[0] === 'guestLanguages' &&
      typeof resetPath[1] === 'number' &&
      resetPath[2] === 'icon'
    ) {
      const locale = draft?.guestLanguages[resetPath[1]]?.locale;
      if (locale)
        mediaResets.current = [...mediaResets.current, ['guestLanguages', locale, 'icon']];
    }
    guard.markChanged();
    setDraft(value);
  };
  return {
    ...state,
    discard,
    load,
    formRef,
    save,
    change,
    suspended,
    guard,
    disabled: !canManage || suspended || status === 'saving',
  };
};
