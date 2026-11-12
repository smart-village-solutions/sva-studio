/** Root pages compose the existing atomic editor state and field owners. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';
import { SsfInstallationV2Editor } from './admin.content-v2-fields.js';
import { SsfRuntimeV2Editor } from './admin.content-v2-runtime-fields.js';
import { SystemOverview } from './admin.content-v2-overview.js';
import { useSsfSystemEditor } from './admin.content-v2-system-state.js';
import type { SsfSystemEditorPage } from './content-v2-editor-contracts.js';
type Editor = ReturnType<typeof useSsfSystemEditor>;
type EditorProps = { editor: Editor; page: SsfSystemEditorPage };
const RuntimeEditor = ({ editor, page }: EditorProps) => {
  const { saved, draft, epoch, disabled, fieldErrors, guard, setDraft } = editor;
  if (!saved || !draft) return null;
  return (
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
  );
};
const SystemStatus = ({ editor }: { editor: Editor }) => {
  const pt = usePluginTranslation('ssf');
  const { status, affectedTenants, load } = editor;
  return (
    <>
      {' '}
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
    </>
  );
};
const SystemFields = ({ editor, page }: EditorProps) => {
  const pt = usePluginTranslation('ssf');
  const { saved, draft, tab, setTab, epoch, fieldErrors, disabled, guard, setDraft } = editor;
  if (!saved || !draft) return null;
  const runtimeEditor = <RuntimeEditor editor={editor} page={page} />;
  return (
    <>
      {' '}
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
            {saved.runtimeTemplate ? runtimeEditor : <p>{pt('administration.templateRequired')}</p>}
          </TabsContent>
        </Tabs>
      ) : (
        <div data-ssf-scope="runtimeTemplate">
          {saved.runtimeTemplate ? runtimeEditor : <p>{pt('administration.templateRequired')}</p>}
        </div>
      )}
    </>
  );
};
const SystemForm = ({ editor, page }: EditorProps) => {
  const pt = usePluginTranslation('ssf');
  const { saved, formRef, disabled, discard, save, status } = editor;
  if (!saved) return null;
  return (
    <div ref={formRef} className="space-y-5">
      <SystemStatus editor={editor} />
      <SystemFields editor={editor} page={page} />{' '}
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
  );
};
export const SsfSystemContentV2Page = ({
  page = 'default-content',
}: {
  page?: SsfSystemEditorPage | 'installation-overview';
}) => {
  const pt = usePluginTranslation('ssf');
  const editor = useSsfSystemEditor(page);
  const { status, saved, draft, load } = editor;
  if (status === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (!saved || !draft)
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
      {page === 'installation-overview' ? (
        <SystemOverview saved={saved} />
      ) : (
        <SystemForm editor={editor} page={page} />
      )}
    </StudioOverviewPageTemplate>
  );
};
