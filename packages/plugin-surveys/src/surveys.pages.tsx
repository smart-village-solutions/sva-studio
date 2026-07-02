import { useParams } from '@tanstack/react-router';

import { SurveyEditorPage } from './surveys.editor.js';

export const SurveyCreatePage = () => <SurveyEditorPage mode="create" />;

export const SurveyEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <SurveyEditorPage mode="edit" contentId={params.contentId ?? params.id} />;
};
