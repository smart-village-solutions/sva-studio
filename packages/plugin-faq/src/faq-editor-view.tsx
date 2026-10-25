import { Link } from '@tanstack/react-router';
import {
  MainserverPrincipalControl,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioSaveButton,
  resolveMainserverPrincipalOptions,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioFormFieldError,
  type StudioSaveStatus,
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
  createdContentId: string | null;
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
  saveStatus: StudioSaveStatus;
  setActingPrincipalType: (value: MainserverPrincipalType) => void;
  setActiveTab: (value: FaqTab) => void;
  setDeleteDialogOpen: (value: boolean) => void;
  setDeleteErrorMessage: (value: string | null) => void;
}>;

const FaqEditorPrimaryAction = ({
  canSave,
  deletePending,
  formId,
  mode,
  pt,
  saveStatus,
  form,
}: Pick<
  FaqEditorViewProps,
  'canSave' | 'deletePending' | 'formId' | 'mode' | 'pt' | 'saveStatus' | 'form'
>) =>
  canSave ? (
    <div className="flex flex-col items-end gap-1">
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">
          {pt(form.watch('visible') ? 'create.visibleEffect' : 'create.hiddenEffect')}
        </p>
      ) : null}
      <StudioSaveButton
        type="submit"
        form={formId}
        status={saveStatus}
        disabled={deletePending}
        labels={{
          idle: pt(mode === 'create' ? 'actions.create' : 'actions.update'),
          saving: pt('actions.saving'),
          saved: pt('actions.saved'),
        }}
      />
    </div>
  ) : undefined;

function FaqPrincipal(props: FaqEditorViewProps) {
  return (
    <div
      className={
        props.mode === 'create' && props.principalControl?.kind === 'selectable'
          ? 'space-y-4 rounded-2xl border border-border/60 bg-card p-5'
          : undefined
      }
    >
      <MainserverPrincipalControl
        fixedLabel={props.mode === 'create' ? props.pt('create.responsible') : undefined}
        id="faq-acting-principal"
        label={props.pt(props.mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
        description={props.pt('principal.description')}
        value={props.actingPrincipalType}
        options={resolveMainserverPrincipalOptions(props.principalControl, {
          value: props.actingPrincipalType,
          label: props.pt(`principal.${props.actingPrincipalType}`),
        })}
        onChange={props.setActingPrincipalType}
      />
    </div>
  );
}

export const FaqEditorView = (props: FaqEditorViewProps) => (
  <StudioDetailPageTemplate
    stickyActions={props.mode === 'create'}
    title={props.pt(props.mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
    description={props.mode === 'edit' ? props.pt('editor.editDescription') : undefined}
    actions={
      <FaqEditorActions
        canDelete={props.canDelete}
        disabled={props.deletePending || props.form.formState.isSubmitting}
        mode={props.mode}
        onDelete={() => props.setDeleteDialogOpen(true)}
        pt={props.pt}
      />
    }
    primaryAction={<FaqEditorPrimaryAction {...props} />}
  >
    <FormProvider {...props.form}>
      <form id={props.formId} className="space-y-6" onSubmit={props.onSubmit} noValidate>
        {props.createdContentId ? (
          <p>
            <Link to="/admin/faq/$id" params={{ id: props.createdContentId }}>
              {props.pt('create.openSaved')}
            </Link>
          </p>
        ) : null}
        {props.saveErrorMessage ? (
          <StudioFormSummary kind="error">{props.saveErrorMessage}</StudioFormSummary>
        ) : null}
        <StudioFormSummaryErrors
          errors={createSummaryErrors(props.form.formState.errors, props.pt)}
          title={props.pt('validation.summaryTitle')}
          onSelectError={({ field }) => props.setActiveTab(fieldTabs[field] ?? 'basis')}
        />
        {props.mode === 'edit' ? <FaqPrincipal {...props} /> : null}
        {props.mode === 'create' ? (
          <p className="text-sm text-muted-foreground">{props.pt('create.intro')}</p>
        ) : null}
        <FaqEditorTabs
          activeTab={props.activeTab}
          contentId={props.contentId}
          form={props.form}
          mode={props.mode}
          onTabChange={props.setActiveTab}
          pt={props.pt}
        />
        {props.mode === 'create' ? <FaqPrincipal {...props} /> : null}
      </form>
    </FormProvider>
    {props.canDelete ? (
      <FaqDeleteDialog
        open={props.deleteDialogOpen}
        pending={props.deletePending}
        errorMessage={props.deleteErrorMessage}
        target={props.form.getValues('question')}
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
