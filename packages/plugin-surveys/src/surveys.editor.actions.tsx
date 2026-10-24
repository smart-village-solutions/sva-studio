import type { UseFormReturn } from 'react-hook-form';
import type { usePluginTranslation } from '@sva/plugin-sdk';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import { Link } from '@tanstack/react-router';
import {
  Button,
  StudioFormSummary,
  StudioSaveButton,
  type StudioSaveStatus,
} from '@sva/studio-ui-react';

import { type SurveyEditorMode } from './surveys.editor.shared.js';

export function SurveyEditorActions({
  pt,
}: Readonly<{
  pt: (key: string) => string;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="secondary">
        <Link to="/admin/content">{pt('actions.back')}</Link>
      </Button>
    </div>
  );
}

export function SurveyEditorPrimaryAction({
  disabled = false,
  mode,
  formId,
  pt,
  saveStatus,
  createStatus,
}: Readonly<{
  mode: SurveyEditorMode;
  disabled?: boolean;
  formId: string;
  pt: (key: string) => string;
  saveStatus: StudioSaveStatus;
  createStatus?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}>) {
  return (
    <div className="flex flex-col items-end gap-1">
      <StudioSaveButton
        type="submit"
        form={formId}
        disabled={disabled}
        status={saveStatus}
        labels={{
          idle:
            mode === 'create' && createStatus
              ? `${pt('actions.create')} (${pt(`fields.statusOptions.${createStatus === 'DRAFT' ? 'draft' : createStatus === 'ACTIVE' ? 'active' : 'archived'}`)})`
              : pt(mode === 'create' ? 'actions.create' : 'actions.update'),
          saving: pt('actions.saving'),
          saved: pt('actions.saved'),
        }}
      />
      {mode === 'create' && createStatus ? <p className="text-sm text-muted-foreground">{pt(`create.effect.${createStatus}`)}</p> : null}
    </div>
  );
}

export function SurveyCreatedResult({
  createdContentId,
  methods,
  pt,
}: Readonly<{
  createdContentId: string;
  methods: UseFormReturn<SurveyDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
}>) {
  return (
    <StudioFormSummary kind="success">
      {methods.formState.isDirty ? (
        <span className="block">{pt('messages.unsavedAfterCreate')}</span>
      ) : null}
      <Link to="/admin/surveys/$id" params={{ id: createdContentId }}>
        {pt('actions.openSavedContent')}
      </Link>
    </StudioFormSummary>
  );
}
