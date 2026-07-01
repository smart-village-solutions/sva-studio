import { useParams } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioOverviewPageTemplate } from '@sva/studio-ui-react';

type SurveyEditorMode = 'create' | 'edit';

const SurveyEditorPlaceholderPage = ({ mode }: Readonly<{ mode: SurveyEditorMode }>) => {
  const pt = usePluginTranslation('surveys');

  return (
    <section className="space-y-6">
      <StudioOverviewPageTemplate
        title={pt(mode === 'create' ? 'pages.createTitle' : 'pages.editTitle')}
        description={pt(mode === 'create' ? 'pages.createDescription' : 'pages.editDescription')}
      >
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{pt('pages.placeholderTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pt('pages.placeholderBody')}</p>
        </section>
      </StudioOverviewPageTemplate>
    </section>
  );
};

export const SurveyCreatePage = () => <SurveyEditorPlaceholderPage mode="create" />;

export const SurveyEditPage = () => {
  useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <SurveyEditorPlaceholderPage mode="edit" />;
};
