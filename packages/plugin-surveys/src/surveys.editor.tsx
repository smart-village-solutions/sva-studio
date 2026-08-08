import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
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

export const SurveyEditorPage = ({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: SurveyEditorMode;
  contentId?: string;
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

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.editorLoading')}</StudioLoadingState>;
  }

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'pages.createTitle' : 'pages.editTitle')}
      description={pt(mode === 'create' ? 'pages.createDescription' : 'pages.editDescription')}
      actions={<SurveyEditorActions pt={pt} />}
      primaryAction={<SurveyEditorPrimaryAction mode={mode} formId={formId} pt={pt} />}
    >
      <FormProvider {...methods}>
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-5"
        >
          {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
          <SurveyPrincipalControl
            actingPrincipalType={actingPrincipalType}
            loadedItem={loadedItem}
            mode={mode}
            onChange={setActingPrincipalType}
            principalControl={principalControl}
            pt={pt}
          />
          <StudioDetailTabs
            ariaLabel={pt('tabs.ariaLabel')}
            tabs={tabs}
            value={activeTab}
            onValueChange={setActiveTab}
            keepMounted
          />
        </form>
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};
