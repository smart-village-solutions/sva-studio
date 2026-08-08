import { useParams } from '@tanstack/react-router';
import type { MainserverPrincipalControlModel } from '@sva/studio-ui-react';

import { SurveyEditorPage } from './surveys.editor.js';

export const SurveyCreatePage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => (
  <SurveyEditorPage mode="create" principalControl={principalControl} />
);

export const SurveyEditPage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => {
  const params = useParams({ strict: false }) as {
    readonly contentId?: string;
    readonly id?: string;
  };
  return (
    <SurveyEditorPage
      mode="edit"
      contentId={params.contentId ?? params.id}
      principalControl={principalControl}
    />
  );
};
