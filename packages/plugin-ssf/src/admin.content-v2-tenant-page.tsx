import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioErrorState, StudioFormActionBar, StudioFormSummary, StudioLoadingState, StudioSection } from '@sva/studio-ui-react';
import { useCallback, useEffect, useState } from 'react';

import { readSsfTenantContentV2, writeSsfTenantContentV2 } from './admin-api.js';
import { SsfRuntimeV2Editor } from './admin.content-v2-runtime-fields.js';
import { ssfRuntimeContentV2FieldsSchema, type SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
import type { SsfTenantContentV2View } from './content-v2-admin-contracts.js';
import { diffSsfContentV2, effectiveSsfRuntimeFieldsV2 } from './content-v2-overrides.js';

type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved' | 'invalid';
const fieldErrors = (issues: readonly { path: PropertyKey[] }[], message: string): Record<string, string> =>
  Object.fromEntries(issues.map((issue) => [issue.path.join('.'), message]));

const draftFromView = (view: SsfTenantContentV2View): SsfRuntimeContentV2Fields | null =>
  view.runtimeTemplate ? effectiveSsfRuntimeFieldsV2(view.runtimeTemplate, view.overrides) : null;

const TenantEditor = ({ saved, draft, status, errors, canManage, onChange, onSave, onDiscard }: {
  saved: SsfTenantContentV2View & { runtimeTemplate: SsfRuntimeContentV2Fields };
  draft: SsfRuntimeContentV2Fields;
  status: Status;
  errors: Record<string, string>;
  canManage: boolean;
  onChange: (value: SsfRuntimeContentV2Fields) => void;
  onSave: () => void;
  onDiscard: () => void;
}) => {
  const pt = usePluginTranslation('ssf');
  return <div className="space-y-5">
    {status === 'saved' ? <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary> : null}
    {status === 'invalid' ? <StudioFormSummary kind="error">{pt('v2.invalid')}</StudioFormSummary> : null}
    {status === 'error' ? <StudioFormSummary kind="error">{pt('status.saveError')}</StudioFormSummary> : null}
    <SsfRuntimeV2Editor value={draft} inherited={saved.runtimeTemplate} onChange={onChange}
      errors={errors} disabled={!canManage || status === 'saving'} supportedLanguages={saved.supportedLanguages ?? null} />
    {canManage ? <StudioFormActionBar>
      <Button type="button" variant="secondary" disabled={status === 'saving'} onClick={onDiscard}>
        {pt('actions.discard')}
      </Button>
      <Button type="button" disabled={status === 'saving'} onClick={onSave}>
        {pt(status === 'saving' ? 'actions.saving' : 'actions.save')}
      </Button>
    </StudioFormActionBar> : null}
  </div>;
};

export const SsfTenantContentV2Page = ({ canManage }: { canManage: boolean }) => {
  const pt = usePluginTranslation('ssf');
  const [saved, setSaved] = useState<SsfTenantContentV2View | null>(null);
  const [draft, setDraft] = useState<SsfRuntimeContentV2Fields | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      const next = await readSsfTenantContentV2();
      setSaved(next);
      setDraft(draftFromView(next));
      setEditorEpoch((current) => current + 1);
      setStatus('ready');
    } catch { setStatus('error'); }
  }, []);
  useEffect(() => void load(), [load]);
  const save = async () => {
    if (!saved?.runtimeTemplate || !draft) { setStatus('invalid'); return; }
    const parsed = ssfRuntimeContentV2FieldsSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues, pt('v2.invalid')));
      setStatus('invalid'); return;
    }
    setErrors({});
    setStatus('saving');
    try {
      const overrides = diffSsfContentV2(saved.runtimeTemplate, draft);
      const next = await writeSsfTenantContentV2((overrides ?? {}) as Record<string, unknown>);
      setSaved(next);
      setDraft(draftFromView(next));
      setEditorEpoch((current) => current + 1);
      setStatus('saved');
    } catch { setStatus('error'); }
  };
  if (status === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (status === 'error' && !saved) {
    return <StudioErrorState><button type="button" onClick={() => void load()}>{pt('status.loadError')}</button></StudioErrorState>;
  }
  if (!saved?.runtimeTemplate || !draft) {
    return <StudioSection title={pt('v2.template')}><p>{pt('v2.notConfigured')}</p></StudioSection>;
  }
  return <TenantEditor key={editorEpoch} saved={{ ...saved, runtimeTemplate: saved.runtimeTemplate }} draft={draft}
    status={status} errors={errors} canManage={canManage} onChange={setDraft}
    onSave={() => void save()} onDiscard={() => {
      setDraft(draftFromView(saved));
      setEditorEpoch((current) => current + 1);
      setErrors({});
      setStatus('ready');
    }} />;
};
