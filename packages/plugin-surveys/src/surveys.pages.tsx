import { useParams } from '@tanstack/react-router';

import { SurveyEditorPage } from './surveys.editor.js';

export const SurveyCreatePage = () => <SurveyEditorPage mode="create" />;

export const SurveyEditPage = () => {
  useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <SurveyEditorPage mode="edit" />;
};
