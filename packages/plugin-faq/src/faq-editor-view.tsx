import {
  Button,
  MainserverPrincipalControl,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioFormSummaryErrors,
  resolveMainserverPrincipalOptions,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { FormProvider, type UseFormReturn } from 'react-hook-form';

import { FaqDeleteDialog, FaqEditorActions, type FaqTranslator } from './faq.editor-chrome.js';
import { FaqEditorTabs, type FaqTab } from './faq.editor-tabs.js';
import type { useFaqEditorLoader } from './faq.editor-page.logic.js';
import type { FaqFormValues } from './faq.types.js';

const fieldTabs: Readonly<Record<string, FaqTab>> = {
  'faq-question': 'basis',
  'faq-language-code': 'basis',
  'faq-answer': 'content',
  'faq-sort-weight': 'settings',
};

const toSummaryError = (field: string, message: string | undefined): StudioFormFieldError[] =>
  message ? [{ field, message }] : [];

const createSummaryErrors = (
  errors: UseFormReturn<FaqFormValues>['formState']['errors'],
  pt: FaqTranslator
) => [
  ...toSummaryError('faq-question', errors.question ? pt('validation.required') : undefined),
  ...toSummaryError(
    'faq-language-code',
    errors.languageCode ? pt('validation.languageCode') : undefined
  ),
  ...toSummaryError('faq-answer', errors.answer ? pt('validation.answer') : undefined),
  ...toSummaryError('faq-sort-weight', errors.sortWeight ? pt('validation.sortWeight') : undefined),
];

type FaqEditorViewProps = Readonly<{
  activeTab: FaqTab;
  canDelete: boolean;
  canSave: boolean;
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
  deleteDialogOpen: boolean;
  deleteErrorMessage: string | null;
  deletePending: boolean;
  form: UseFormReturn<FaqFormValues>;
  formId: string;
  loadedItem: ReturnType<typeof useFaqEditorLoader>['loadedItem'];
  mode: 'create' | 'edit';
  onDelete: () => Promise<void>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  principalControl?: MainserverPrincipalControlModel;
  pt: FaqTranslator;
  saveErrorMessage: string | null;
  setActingPrincipalType: (value: MainserverPrincipalType) => void;
  setActiveTab: (value: FaqTab) => void;
  setDeleteDialogOpen: (value: boolean) => void;
  setDeleteErrorMessage: (value: string | null) => void;
}>;

export const FaqEditorView = (props: FaqEditorViewProps) => (
  <StudioDetailPageTemplate
    title={props.pt(props.mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
    description={props.pt(
      props.mode === 'create' ? 'editor.createDescription' : 'editor.editDescription'
    )}
    actions={
      <FaqEditorActions
        canDelete={props.canDelete}
        disabled={props.deletePending || props.form.formState.isSubmitting}
        mode={props.mode}
        onDelete={() => props.setDeleteDialogOpen(true)}
        pt={props.pt}
      />
    }
    primaryAction={
      props.canSave ? (
        <Button
          type="submit"
          form={props.formId}
          disabled={props.form.formState.isSubmitting || props.deletePending}
        >
          {props.pt(props.mode === 'create' ? 'actions.create' : 'actions.update')}
        </Button>
      ) : undefined
    }
  >
    <FormProvider {...props.form}>
      <form id={props.formId} className="space-y-5" onSubmit={props.onSubmit} noValidate>
        {props.saveErrorMessage ? (
          <StudioFormSummary kind="error">{props.saveErrorMessage}</StudioFormSummary>
        ) : null}
        <StudioFormSummaryErrors
          errors={createSummaryErrors(props.form.formState.errors, props.pt)}
          title={props.pt('validation.summaryTitle')}
          onSelectError={({ field }) => props.setActiveTab(fieldTabs[field] ?? 'basis')}
        />
        <MainserverPrincipalControl
          id="faq-acting-principal"
          label={props.pt(props.mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
          description={props.pt('principal.description')}
          value={props.actingPrincipalType}
          options={resolveMainserverPrincipalOptions(props.principalControl, {
            value: props.actingPrincipalType,
            label: props.pt(`principal.${props.actingPrincipalType}`),
          })}
          onChange={props.setActingPrincipalType}
          dataProvider={
            props.mode === 'edit' ? (props.loadedItem?.dataProvider ?? null) : undefined
          }
          dataProviderLabel={props.pt('principal.dataProvider')}
          dataProviderUnavailableLabel={props.pt('principal.unavailable')}
        />
        <FaqEditorTabs
          activeTab={props.activeTab}
          contentId={props.contentId}
          form={props.form}
          mode={props.mode}
          onTabChange={props.setActiveTab}
          pt={props.pt}
        />
      </form>
    </FormProvider>
    {props.canDelete ? (
      <FaqDeleteDialog
        open={props.deleteDialogOpen}
        pending={props.deletePending}
        errorMessage={props.deleteErrorMessage}
        onConfirm={() => void props.onDelete()}
        onCancel={() => {
          props.setDeleteDialogOpen(false);
          props.setDeleteErrorMessage(null);
        }}
        pt={props.pt}
      />
    ) : null}
  </StudioDetailPageTemplate>
);
