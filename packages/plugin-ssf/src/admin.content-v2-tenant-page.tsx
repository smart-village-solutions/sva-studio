import { focusSsfInvalidField } from './admin.content-v2-field-control.js';
/** Independently saved tenant projections over the existing SSF content aggregate. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioSection,
  useStudioEditorLeaveGuard,
  useStudioEditorSuspended,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readSsfTenantContentV2,
  writeSsfTenantContentV2,
  SsfContentConflictError,
} from './admin-api.js';
import { SsfRuntimeV2Editor } from './admin.content-v2-runtime-fields.js';
import type {
  SsfTenantContentV2View,
  SsfVersionedContent,
  SsfTenantEditorPage,
} from './content-v2-admin-contracts.js';
import { type SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
import {
  resolveRecordingRetentionHours,
  ssfRecordingSettingsSchema,
} from './content-v2-recording.js';
import {
  effectiveSsfRuntimeFieldsV2,
  projectSsfTenantPageOverrides,
} from './content-v2-overrides.js';

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

type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved' | 'invalid' | 'conflict';
export const SsfTenantContentV2Page = ({
  canManage,
  page = 'appearance',
}: {
  canManage: boolean;
  page?: SsfTenantEditorPage | 'overview';
}) => {
  const pt = usePluginTranslation('ssf');
  const suspended = useStudioEditorSuspended();
  const [saved, setSaved] = useState<SsfVersionedContent<SsfTenantContentV2View> | null>(null);
  const [baseline, setBaseline] = useState<SsfRuntimeContentV2Fields | null>(null);
  const [draft, setDraft] = useState<SsfRuntimeContentV2Fields | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const mediaResets = useRef<readonly string[][]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  const accept = (next: SsfVersionedContent<SsfTenantContentV2View>) => {
    const value = draftFromView(next);
    mediaResets.current = [];
    setSaved(next);
    setDraft(value);
    setBaseline(value);
    setErrors({});
  };
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      accept(await readSsfTenantContentV2());
      setStatus('ready');
    } catch {
      setStatus('error');
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
  const save = async (): Promise<boolean> => {
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
  if (status === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (!saved)
    return (
      <StudioErrorState>
        <Button type="button" onClick={() => void load()}>
          {pt('status.loadError')}
        </Button>
      </StudioErrorState>
    );
  return (
    <StudioOverviewPageTemplate
      title={pt(`administration.pages.${page}`)}
      description={pt(`administration.descriptions.${page}`)}
    >
      {!saved.runtimeTemplate || !draft ? (
        <StudioSection title={pt('v2.template')}>
          <p>{pt('v2.notConfigured')}</p>
        </StudioSection>
      ) : page === 'overview' ? (
        <TenantOverview
          value={effectiveSsfRuntimeFieldsV2(saved.runtimeTemplate, saved.overrides)}
          retentionHours={resolveRecordingRetentionHours(
            saved.runtimeTemplate.recording?.retentionHours,
            ssfRecordingSettingsSchema.parse(saved.overrides?.['recording'] ?? {}).retentionHours
          )}
        />
      ) : (
        <div ref={formRef} className="space-y-5">
          {status === 'conflict' ? (
            <div className="space-y-3">
              <StudioFormSummary kind="error">{pt('administration.conflict')}</StudioFormSummary>
              <Button type="button" variant="secondary" onClick={() => void load()}>
                {pt('administration.reloadDiscard')}
              </Button>
            </div>
          ) : status === 'error' || status === 'invalid' ? (
            <StudioFormSummary kind="error">
              {pt(status === 'invalid' ? 'v2.invalid' : 'status.saveError')}
            </StudioFormSummary>
          ) : status === 'saved' ? (
            <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary>
          ) : null}
          <SsfRuntimeV2Editor
            key={epoch}
            page={page}
            value={draft}
            inherited={saved.runtimeTemplate}
            onChange={(value, resetPath) => {
              if (resetPath?.[0] === 'branding' && typeof resetPath[1] === 'string') {
                mediaResets.current = [...mediaResets.current, ['branding', resetPath[1]]];
              } else if (
                resetPath?.[0] === 'guestLanguages' &&
                typeof resetPath[1] === 'number' &&
                resetPath[2] === 'icon'
              ) {
                const locale = draft.guestLanguages[resetPath[1]]?.locale;
                if (locale)
                  mediaResets.current = [
                    ...mediaResets.current,
                    ['guestLanguages', locale, 'icon'],
                  ];
              }
              guard.markChanged();
              setDraft(value);
            }}
            errors={errors}
            disabled={!canManage || suspended || status === 'saving'}
            supportedLanguages={saved.supportedLanguages}
          />
          {canManage ? (
            <StudioFormActionBar>
              <Button
                type="button"
                variant="secondary"
                disabled={status === 'saving'}
                onClick={discard}
              >
                {pt('actions.discard')}
              </Button>
              <Button
                type="button"
                disabled={status === 'saving' || suspended}
                onClick={() => void save()}
              >
                {pt(status === 'saving' ? 'actions.saving' : 'actions.save')}
              </Button>
            </StudioFormActionBar>
          ) : null}
        </div>
      )}
    </StudioOverviewPageTemplate>
  );
};

const TenantOverview = ({
  value,
  retentionHours,
}: {
  value: SsfRuntimeContentV2Fields;
  retentionHours: number;
}) => {
  const pt = usePluginTranslation('ssf');
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(['appearance', 'languages', 'recordings', 'feedback'] as const).map((page) => (
        <StudioSection key={page} title={pt(`administration.pages.${page}`)}>
          {page === 'appearance' ? (
            <p>
              {pt('v2.logoUrl')}: {value.branding.logo?.url ?? pt('v2.notConfigured')}
            </p>
          ) : page === 'languages' ? (
            <>
              <p>
                {pt('v2.staff')}: {value.staff.locale}
              </p>
              <p>
                {value.guestLanguages
                  .map((entry) => `${entry.nativeName} (${entry.locale})`)
                  .join(', ')}
              </p>
            </>
          ) : page === 'recordings' ? (
            <>
              <p>
                {pt('administration.configuredRecording')}:{' '}
                {pt(
                  value.recording?.enabled ? 'administration.enabled' : 'administration.disabled'
                )}
              </p>
              <p>
                {pt('v2.recording.effectiveRetention')}: {retentionHours}
              </p>
            </>
          ) : (
            <>
              <p>
                {pt('v2.staff')}: {value.staff.feedback.headline}
              </p>
              {value.guestLanguages.map((entry) => (
                <p key={entry.locale}>
                  {entry.nativeName}: {entry.feedback.headline}
                </p>
              ))}
            </>
          )}
          <Button asChild variant="secondary">
            <a href={`/plugins/ssf/${page}`}>{pt('administration.open')}</a>
          </Button>
        </StudioSection>
      ))}
    </div>
  );
};
