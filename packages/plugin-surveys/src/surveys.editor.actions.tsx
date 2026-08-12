import { Link } from '@tanstack/react-router';
import { Button, StudioSaveButton, type StudioSaveStatus } from '@sva/studio-ui-react';

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
}: Readonly<{
  mode: SurveyEditorMode;
  disabled?: boolean;
  formId: string;
  pt: (key: string) => string;
  saveStatus: StudioSaveStatus;
}>) {
  return (
    <StudioSaveButton
      type="submit"
      form={formId}
      disabled={disabled}
      status={saveStatus}
      labels={{
        idle: pt(mode === 'create' ? 'actions.create' : 'actions.update'),
        saving: pt('actions.saving'),
        saved: pt('actions.saved'),
      }}
    />
  );
}
