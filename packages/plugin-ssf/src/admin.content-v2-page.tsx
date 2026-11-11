import { focusSsfInvalidField } from './admin.content-v2-field-control.js';
/** Root page projections retain one atomic save unit across both persistence scopes. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioSection,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useStudioEditorLeaveGuard,
  useStudioEditorSuspended,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  readSsfSystemContentV2,
  writeSsfSystemContentV2,
  SsfContentConflictError,
  SsfRecordingPolicyConflictError,
} from './admin-api.js';
import { editableSystemContent, SsfInstallationV2Editor } from './admin.content-v2-fields.js';
import { SsfRuntimeV2Editor } from './admin.content-v2-runtime-fields.js';
import {
  ssfInstallationContentV2FieldsSchema,
  ssfRuntimeContentV2FieldsSchema,
} from './content-v2-contracts.js';
import type {
  SsfSystemContentV2View,
  SsfSystemEditorPage,
  SsfVersionedContent,
} from './content-v2-admin-contracts.js';

type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved' | 'invalid' | 'conflict';
type Draft = ReturnType<typeof editableSystemContent>;
export const SsfSystemContentV2Page = ({
  page = 'default-content',
}: {
  page?: SsfSystemEditorPage | 'installation-overview';
}) => {
  const pt = usePluginTranslation('ssf');
  const suspended = useStudioEditorSuspended();
  const [saved, setSaved] = useState<SsfVersionedContent<SsfSystemContentV2View> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [tab, setTab] = useState('installation');
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [affectedTenants, setAffectedTenants] = useState<readonly string[]>([]);
  const saving = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  const accept = (next: SsfVersionedContent<SsfSystemContentV2View>) => {
    const editable = editableSystemContent(next);
    setSaved(next);
    setDraft(editable);
    setBaseline(editable);
    setErrors({});
    setAffectedTenants([]);
  };
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      accept(await readSsfSystemContentV2());
      setStatus('ready');
    } catch {
      setStatus('error');
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
  const save = async (): Promise<boolean> => {
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
      const installation =
        page === 'default-content' &&
        JSON.stringify(draft.installation) !== JSON.stringify(baseline.installation)
          ? draft.installation
          : null;
      const runtimeTemplate =
        JSON.stringify(draft.runtimeTemplate) !== JSON.stringify(baseline.runtimeTemplate)
          ? draft.runtimeTemplate
          : null;
      const parsedInstallation = installation
        ? ssfInstallationContentV2FieldsSchema.safeParse(installation)
        : null;
      const parsedRuntime = runtimeTemplate
        ? ssfRuntimeContentV2FieldsSchema.safeParse(runtimeTemplate)
        : null;
      const issues = [
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
      if (error instanceof SsfRecordingPolicyConflictError)
        setAffectedTenants(error.affectedTenants);
      setStatus(error instanceof SsfContentConflictError ? 'conflict' : 'error');
      return false;
    } finally {
      saving.current = false;
    }
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
  if (status === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (!saved || !draft)
    return (
      <StudioErrorState>
        <Button type="button" onClick={() => void load()}>
          {pt('status.loadError')}
        </Button>
      </StudioErrorState>
    );
  const disabled = suspended || status === 'saving';
  const runtimeEditor =
    page !== 'installation-overview' ? (
      <SsfRuntimeV2Editor
        key={`runtime-${epoch}`}
        page={page}
        existingGuestLocales={
          saved.runtimeTemplate?.guestLanguages.map((entry) => entry.locale) ?? []
        }
        value={draft.runtimeTemplate}
        supportedLanguages={saved.supportedLanguages}
        disabled={disabled}
        errors={fieldErrors.runtimeTemplate}
        onChange={(runtimeTemplate) => {
          guard.markChanged();
          setDraft({ ...draft, runtimeTemplate });
        }}
      />
    ) : null;
  return (
    <StudioOverviewPageTemplate
      title={pt(`administration.pages.${page}`)}
      description={pt(`administration.descriptions.${page}`)}
    >
      {page === 'installation-overview' ? (
        <div className="grid gap-5 md:grid-cols-2">
          <StudioSection title={pt('v2.installation')}>
            {saved.installation ? (
              <>
                <p>
                  {pt('v2.locale')}: {saved.installation.localization.locale}
                </p>
                <p>
                  {pt('v2.logoUrl')}:{' '}
                  {saved.installation.branding.logo?.url ?? pt('v2.notConfigured')}
                </p>
              </>
            ) : (
              <p>{pt('v2.notConfigured')}</p>
            )}
            <Button asChild variant="secondary">
              <a href="/plugins/ssf/system/default-content">
                {pt('administration.pages.default-content')}
              </a>
            </Button>
          </StudioSection>
          <StudioSection title={pt('v2.template')}>
            {saved.runtimeTemplate ? (
              <>
                <p>
                  {pt('v2.staff')}: {saved.runtimeTemplate.staff.locale}
                </p>
                <p>
                  {saved.runtimeTemplate.guestLanguages
                    .map((entry) => `${entry.nativeName} (${entry.locale})`)
                    .join(', ')}
                </p>
                <p>
                  {pt('v2.recording.retentionHours')}:{' '}
                  {saved.runtimeTemplate.recording?.retentionHours ?? 720}
                </p>
              </>
            ) : (
              <p>{pt('v2.notConfigured')}</p>
            )}
            <Button asChild variant="secondary">
              <a href="/plugins/ssf/system/default-configuration">
                {pt('administration.pages.default-configuration')}
              </a>
            </Button>
          </StudioSection>
        </div>
      ) : (
        <div ref={formRef} className="space-y-5">
          {status === 'saved' ? (
            <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary>
          ) : null}
          {status === 'invalid' || status === 'error' || status === 'conflict' ? (
            <div className="space-y-3">
              <StudioFormSummary kind="error">
                {pt(
                  status === 'conflict'
                    ? 'administration.conflict'
                    : status === 'invalid'
                      ? 'v2.invalid'
                      : 'status.saveError'
                )}
              </StudioFormSummary>
              {affectedTenants.length ? (
                <>
                  <p>{pt('v2.recording.affectedTenants')}</p>
                  <ul>
                    {affectedTenants.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {status === 'conflict' ? (
                <Button type="button" variant="secondary" onClick={() => void load()}>
                  {pt('administration.reloadDiscard')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {page === 'default-content' ? (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList
                className="flex max-w-full flex-wrap justify-start"
                aria-label={pt('administration.pages.default-content')}
              >
                <TabsTrigger value="installation">{pt('v2.installation')}</TabsTrigger>
                <TabsTrigger value="runtimeTemplate">{pt('v2.template')}</TabsTrigger>
              </TabsList>
              <TabsContent
                data-ssf-scope="installation"
                value="installation"
                forceMount
                hidden={tab !== 'installation'}
              >
                {!saved.installation ? <p>{pt('v2.notConfigured')}</p> : null}
                <SsfInstallationV2Editor
                  key={`installation-${epoch}`}
                  value={draft.installation}
                  errors={fieldErrors.installation}
                  supportedLanguages={saved.supportedLanguages}
                  disabled={disabled}
                  onChange={(installation) => {
                    guard.markChanged();
                    setDraft({ ...draft, installation });
                  }}
                />
              </TabsContent>
              <TabsContent
                data-ssf-scope="runtimeTemplate"
                value="runtimeTemplate"
                forceMount
                hidden={tab !== 'runtimeTemplate'}
              >
                {saved.runtimeTemplate ? (
                  runtimeEditor
                ) : (
                  <p>{pt('administration.templateRequired')}</p>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div data-ssf-scope="runtimeTemplate">
              {saved.runtimeTemplate ? (
                runtimeEditor
              ) : (
                <p>{pt('administration.templateRequired')}</p>
              )}
            </div>
          )}
          {saved.runtimeTemplate || page === 'default-content' ? (
            <StudioFormActionBar>
              <Button type="button" variant="secondary" disabled={disabled} onClick={discard}>
                {pt('actions.discard')}
              </Button>
              <Button type="button" disabled={disabled} onClick={() => void save()}>
                {pt(status === 'saving' ? 'actions.saving' : 'actions.save')}
              </Button>
            </StudioFormActionBar>
          ) : null}
        </div>
      )}
    </StudioOverviewPageTemplate>
  );
};
