import { Link } from '@tanstack/react-router';
import { Button } from '@sva/studio-ui-react';

import { type SurveyEditorMode } from './surveys.editor.shared.js';

export function SurveyEditorActions({
  mode,
  formId,
  pt,
}: Readonly<{
  mode: SurveyEditorMode;
  formId: string;
  pt: (key: string) => string;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link to="/admin/content">{pt('actions.back')}</Link>
      </Button>
      <Button type="submit" form={formId}>
        {pt(mode === 'create' ? 'actions.create' : 'actions.update')}
      </Button>
    </div>
  );
}
