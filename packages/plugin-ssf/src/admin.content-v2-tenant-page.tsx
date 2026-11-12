/** Independently saved tenant pages over the existing SSF content aggregate. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioSection,
} from '@sva/studio-ui-react';
import { SsfRuntimeV2Editor } from './admin.content-v2-runtime-fields.js';
import { useSsfTenantEditor } from './admin.content-v2-tenant-state.js';
import { TenantOverview } from './admin.content-v2-overview.js';
import type { SsfTenantEditorPage } from './content-v2-editor-contracts.js';
import {
  resolveRecordingRetentionHours,
  ssfRecordingSettingsSchema,
} from './content-v2-recording.js';
import { effectiveSsfRuntimeFieldsV2 } from './content-v2-overrides.js';
type Editor = ReturnType<typeof useSsfTenantEditor>;
const TenantStatus = ({ editor }: { editor: Editor }) => {
  const pt = usePluginTranslation('ssf');
  const { status, load } = editor;
  return (
    <>
      {' '}
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
    </>
  );
};
const TenantForm = ({
  editor,
  page,
  canManage,
}: {
  editor: Editor;
  page: SsfTenantEditorPage;
  canManage: boolean;
}) => {
  const pt = usePluginTranslation('ssf');
  const { saved, draft, formRef, epoch, errors, suspended, status, save, discard } = editor;
  if (!saved?.runtimeTemplate || !draft) return null;
  return (
    <div ref={formRef} className="space-y-5">
      <TenantStatus editor={editor} />
      <SsfRuntimeV2Editor
        key={epoch}
        page={page}
        value={draft}
        inherited={saved.runtimeTemplate}
        onChange={editor.change}
        errors={errors}
        disabled={editor.disabled}
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
  );
};
export const SsfTenantContentV2Page = ({
  canManage,
  page = 'appearance',
}: {
  canManage: boolean;
  page?: SsfTenantEditorPage | 'overview';
}) => {
  const pt = usePluginTranslation('ssf');
  const editor = useSsfTenantEditor(page, canManage);
  const { status, saved, draft, load } = editor;
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
        <TenantForm editor={editor} page={page} canManage={canManage} />
      )}
    </StudioOverviewPageTemplate>
  );
};
