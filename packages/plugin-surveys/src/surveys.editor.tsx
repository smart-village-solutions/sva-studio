import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  MainserverPrincipalControl,
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
import { SurveyEditorActions, SurveyEditorPrimaryAction } from './surveys.editor.actions.js';
import { useSurveyEditorController } from './surveys.editor-logic.js';
import { type SurveyEditorMode, type SurveyEditorTabId } from './surveys.editor.shared.js';
import { createSurveyEditorTabs } from './surveys.editor-tabs.js';

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
  <MainserverPrincipalControl
    id="survey-acting-principal"
    label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
    description={pt('principal.description')}
    value={actingPrincipalType}
    options={resolveMainserverPrincipalOptions(principalControl, {
      value: actingPrincipalType,
      label: pt(`principal.${actingPrincipalType}`),
    })}
    onChange={onChange}
    dataProvider={mode === 'edit' ? (loadedItem?.dataProvider ?? null) : undefined}
    dataProviderLabel={pt('principal.dataProvider')}
    dataProviderUnavailableLabel={pt('principal.unavailable')}
  />
);

const SurveyEditorForm = ({
  actingPrincipalType,
  activeTab,
  canMutate,
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
  canMutate: boolean;
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
}>) => (
  <FormProvider {...methods}>
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        if (canMutate) void submit();
      }}
      className="space-y-5"
    >
      {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
      {!canMutate ? (
        <StudioFormSummary kind="error">{pt('messages.updateUnavailable')}</StudioFormSummary>
      ) : null}
      <fieldset className="min-w-0 space-y-5 border-0 p-0" disabled={!canMutate}>
        <SurveyPrincipalControl
          actingPrincipalType={actingPrincipalType}
          loadedItem={loadedItem}
          mode={mode}
          onChange={onPrincipalChange}
          principalControl={principalControl}
          pt={pt}
        />
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          tabs={tabs}
          value={activeTab}
          onValueChange={onActiveTabChange}
          keepMounted
        />
      </fieldset>
    </form>
  </FormProvider>
);

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
  const [activeTab, setActiveTab] = React.useState<SurveyEditorTabId>('basis');
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) {
      setActingPrincipalType(principalControl.value);
    }
  }, [principalControl]);
  const methods = useForm<SurveyDetailFormValues>({
    defaultValues: createDefaultSurveyDetailFormValues(),
  });
  const { isLoading, loadedItem, status, submit } = useSurveyEditorController({
    mode,
    contentId,
    methods,
    pt,
    actingPrincipalType,
    navigateToContentList: () => navigate({ to: '/admin/content' }),
  });
  const tabs = React.useMemo(
    () => createSurveyEditorTabs(pt, mode, loadedItem, contentId),
    [contentId, loadedItem, mode, pt]
  );
  const canMutate = mode === 'create' || canUpdate;

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.editorLoading')}</StudioLoadingState>;
  }

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'pages.createTitle' : 'pages.editTitle')}
      description={pt(mode === 'create' ? 'pages.createDescription' : 'pages.editDescription')}
      actions={<SurveyEditorActions pt={pt} />}
      primaryAction={
        <SurveyEditorPrimaryAction disabled={!canMutate} mode={mode} formId={formId} pt={pt} />
      }
    >
      <SurveyEditorForm
        actingPrincipalType={actingPrincipalType}
        activeTab={activeTab}
        canMutate={canMutate}
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
