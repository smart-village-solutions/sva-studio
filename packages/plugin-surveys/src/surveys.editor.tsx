import React from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  addStudioCreatedSaveFeedback,
  hasStudioCreatedSaveFeedback,
  MainserverPrincipalControl,
  removeStudioSaveFeedback,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummary,
  StudioLoadingState,
  resolveMainserverPrincipalOptions,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from './surveys.detail-form.js';
import {
  SurveyCreatedResult,
  SurveyEditorActions,
  SurveyEditorPrimaryAction,
} from './surveys.editor.actions.js';
import { useSurveyEditorController } from './surveys.editor-logic.js';
import { type SurveyEditorMode, type SurveyEditorTabId } from './surveys.editor.shared.js';
import { SurveyCreateFields, createSurveyEditorTabs } from './surveys.editor-tabs.js';
import { useSurveyMutationAccess as useMutationAccess } from './surveys.lifecycle-access.js';
const formId = 'survey-detail-form';
const SurveyPrincipalControl = ({
  actingPrincipalType,
  loadedItem,
  mode,
  onChange,
  principalControl,
  pt,
}: Readonly<{
  actingPrincipalType: MainserverPrincipalType;
  loadedItem: ReturnType<typeof useSurveyEditorController>['loadedItem'];
  mode: SurveyEditorMode;
  onChange: (value: MainserverPrincipalType) => void;
  principalControl?: MainserverPrincipalControlModel;
  pt: ReturnType<typeof usePluginTranslation>;
}>) => (
  <div
    className={
      mode === 'create' && principalControl?.kind === 'selectable'
        ? 'space-y-4 rounded-2xl border border-border/60 bg-card p-5'
        : undefined
    }
  >
    <MainserverPrincipalControl
      fixedLabel={mode === 'create' ? pt('create.responsible') : undefined}
      id="survey-acting-principal"
      label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
      description={pt('principal.description')}
      value={actingPrincipalType}
      options={resolveMainserverPrincipalOptions(principalControl, {
        value: actingPrincipalType,
        label: pt(`principal.${actingPrincipalType}`),
      })}
      onChange={onChange}
    />
  </div>
);
const SurveyEditorForm = ({
  actingPrincipalType,
  activeTab,
  canEdit,
  canSave,
  loadedItem,
  methods,
  mode,
  onActiveTabChange,
  onPrincipalChange,
  principalControl,
  pt,
  status,
  submit,
  tabs,
}: Readonly<{
  actingPrincipalType: MainserverPrincipalType;
  activeTab: SurveyEditorTabId;
  canEdit: boolean;
  canSave: boolean;
  loadedItem: ReturnType<typeof useSurveyEditorController>['loadedItem'];
  methods: UseFormReturn<SurveyDetailFormValues>;
  mode: SurveyEditorMode;
  onActiveTabChange: (tab: SurveyEditorTabId) => void;
  onPrincipalChange: (value: MainserverPrincipalType) => void;
  principalControl?: MainserverPrincipalControlModel;
  pt: ReturnType<typeof usePluginTranslation>;
  status: ReturnType<typeof useSurveyEditorController>['status'];
  submit: ReturnType<typeof useSurveyEditorController>['submit'];
  tabs: ReturnType<typeof createSurveyEditorTabs>;
}>) => {
  const principal = (
    <SurveyPrincipalControl
      actingPrincipalType={actingPrincipalType}
      loadedItem={loadedItem}
      mode={mode}
      onChange={onPrincipalChange}
      principalControl={principalControl}
      pt={pt}
    />
  );
  return (
    <FormProvider {...methods}>
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) void submit();
        }}
        className="space-y-5"
      >
        {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
        {!canSave ? (
          <StudioFormSummary kind="error">{pt('messages.updateUnavailable')}</StudioFormSummary>
        ) : null}
        {mode === 'edit' ? principal : null}
        <fieldset className="min-w-0 space-y-5 border-0 p-0" disabled={!canEdit}>
          {mode === 'create' ? (
            <SurveyCreateFields pt={pt} />
          ) : (
            <StudioDetailTabs
              ariaLabel={pt('tabs.ariaLabel')}
              tabs={tabs}
              value={activeTab}
              onValueChange={onActiveTabChange}
              keepMounted
            />
          )}
        </fieldset>
        {mode === 'create' ? principal : null}
      </form>
    </FormProvider>
  );
};
const useSurveyActingPrincipal = (principalControl?: MainserverPrincipalControlModel) => {
  const [value, setValue] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) {
      setValue(principalControl.value);
    }
  }, [principalControl]);

  return [value, setValue] as const;
};

const useSurveyForm = () =>
  useForm<SurveyDetailFormValues>({ defaultValues: createDefaultSurveyDetailFormValues() });

const useSurveyTabs = (
  pt: ReturnType<typeof usePluginTranslation>,
  mode: SurveyEditorMode,
  loadedItem: ReturnType<typeof useSurveyEditorController>['loadedItem'],
  contentId?: string
) =>
  React.useMemo(
    () => createSurveyEditorTabs(pt, mode, loadedItem, contentId),
    [contentId, loadedItem, mode, pt]
  );

function createSurveyNavigation(navigate: ReturnType<typeof useNavigate>, contentId?: string) {
  return {
    onInitialSavedConsumed: () =>
      navigate({
        to: '/admin/surveys/$id',
        params: { id: contentId ?? '' },
        replace: true,
        state: (previous) => removeStudioSaveFeedback(previous),
      }),
    navigateToCreatedDetail: (id: string) =>
      navigate({
        to: '/admin/surveys/$id',
        params: { id },
        state: (previous) => addStudioCreatedSaveFeedback(previous, 'surveys', id),
      }),
  };
}

export const SurveyEditorPage = ({
  mode,
  contentId,
  canUpdate = false,
  principalControl,
}: Readonly<{
  mode: SurveyEditorMode;
  contentId?: string;
  canUpdate?: boolean;
  principalControl?: MainserverPrincipalControlModel;
}>) => {
  const pt = usePluginTranslation('surveys');
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState<SurveyEditorTabId>('basis');
  const [actingPrincipalType, setActingPrincipalType] = useSurveyActingPrincipal(principalControl);
  const methods = useSurveyForm();
  const { createdContentId, isLoading, loadedItem, resourceAccess, saveStatus, status, submit } =
    useSurveyEditorController({
      mode,
      contentId,
      methods,
      pt,
      actingPrincipalType,
      initiallySaved: hasStudioCreatedSaveFeedback(location.state, 'surveys', contentId),
      ...createSurveyNavigation(navigate, contentId),
    });
  const tabs = useSurveyTabs(pt, mode, loadedItem, contentId);
  const access = useMutationAccess(mode, canUpdate, loadedItem?.status, resourceAccess, methods);

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.editorLoading')}</StudioLoadingState>;
  }

  return (
    <StudioDetailPageTemplate
      stickyActions={mode === 'create'}
      title={pt(mode === 'create' ? 'pages.createTitle' : 'pages.editTitle')}
      description={mode === 'edit' ? pt('pages.editDescription') : undefined}
      actions={<SurveyEditorActions pt={pt} />}
      primaryAction={
        <SurveyEditorPrimaryAction
          disabled={!access.canSave || (mode === 'create' && createdContentId !== null)}
          mode={mode}
          formId={formId}
          pt={pt}
          saveStatus={saveStatus}
          createStatus={methods.watch('basis.status')}
        />
      }
    >
      {mode === 'create' && createdContentId ? (
        <SurveyCreatedResult createdContentId={createdContentId} methods={methods} pt={pt} />
      ) : null}
      <SurveyEditorForm
        actingPrincipalType={actingPrincipalType}
        activeTab={activeTab}
        canEdit={access.canEdit}
        canSave={access.canSave && !(mode === 'create' && createdContentId !== null)}
        loadedItem={loadedItem}
        methods={methods}
        mode={mode}
        onActiveTabChange={setActiveTab}
        onPrincipalChange={setActingPrincipalType}
        principalControl={principalControl}
        pt={pt}
        status={status}
        submit={submit}
        tabs={tabs}
      />
    </StudioDetailPageTemplate>
  );
};
