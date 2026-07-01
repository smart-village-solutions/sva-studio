import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDetailPageTemplate, StudioDetailTabs, StudioFormSummary, StudioLoadingState } from '@sva/studio-ui-react';

import { createDefaultSurveyDetailFormValues, type SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyEditorActions } from './surveys.editor.actions.js';
import { useSurveyEditorController } from './surveys.editor.controller.js';
import {
  createSurveyEditorTabs,
  type SurveyEditorMode,
  type SurveyEditorTabId,
} from './surveys.editor.shared.js';

const formId = 'survey-detail-form';

export const SurveyEditorPage = ({
  mode,
  contentId,
}: Readonly<{ mode: SurveyEditorMode; contentId?: string }>) => {
  const pt = usePluginTranslation('surveys');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<SurveyEditorTabId>('basis');
  const methods = useForm<SurveyDetailFormValues>({ defaultValues: createDefaultSurveyDetailFormValues() });
  const { isLoading, loadedItem, status, submit } = useSurveyEditorController({
    mode,
    contentId,
    methods,
    pt,
    navigateToContentList: () => navigate({ to: '/admin/content' }),
  });
  const tabs = React.useMemo(() => createSurveyEditorTabs(pt, mode, loadedItem, contentId), [contentId, loadedItem, mode, pt]);

  if (isLoading) {
    return <StudioLoadingState>{pt('history.loading')}</StudioLoadingState>;
  }

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'pages.createTitle' : 'pages.editTitle')}
      description={pt(mode === 'create' ? 'pages.createDescription' : 'pages.editDescription')}
      actions={<SurveyEditorActions mode={mode} formId={formId} pt={pt} />}
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
          <StudioDetailTabs ariaLabel={pt('tabs.ariaLabel')} tabs={tabs} value={activeTab} onValueChange={setActiveTab} keepMounted />
        </form>
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};
