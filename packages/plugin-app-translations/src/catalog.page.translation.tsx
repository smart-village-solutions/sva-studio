import { Button } from '@sva/studio-ui-react';
import { type CatalogPageViewModel } from './catalog.page.state.js';
export const CatalogConfigure = ({ model }: { model: CatalogPageViewModel }) => {
  const { contractId, data, dirty, busy, pt, canWrite, mutate } = model;
  if (!data) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{pt('configureLanguagesHelp')}</p>
      <Button
        type="button"
        variant="secondary"
        disabled={!canWrite || busy || dirty}
        onClick={() =>
          void mutate({
            operation: 'configureLocales',
            contractId,
            expectedRevision: data.draft.draftRevision,
          })
        }
      >
        {pt('configureLanguages')}
      </Button>
    </div>
  );
};

export const CatalogTranslation = ({ model }: { model: CatalogPageViewModel }) => {
  const {
    dirty,
    busy,
    translationCounts,
    pt,
    languageName,
    canWrite,
    jobActive,
    hasMissingTranslations,
    translate,
  } = model;
  return (
    <section className="space-y-3" aria-label={pt('translateMissing')}>
      <p className="text-sm text-muted-foreground">{pt('translateHelp')}</p>
      {translationCounts && (
        <p className="text-sm text-muted-foreground">
          {pt('translationPlan', {
            count: Object.values(translationCounts).reduce((sum, count) => sum + count, 0),
          })}{' '}
          {Object.entries(translationCounts)
            .map(([locale, count]) => `${languageName(locale)}: ${count}`)
            .join(' · ')}
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={!canWrite || busy || dirty || jobActive || !hasMissingTranslations}
        onClick={() => void translate({ mode: 'missing' })}
      >
        {pt('translateMissing')}
      </Button>
      <CatalogProgress model={model} />
    </section>
  );
};

export const CatalogProgress = ({ model }: { model: CatalogPageViewModel }) => {
  const { job, pt, languageName, showJobProgress } = model;
  return (
    <>
      {showJobProgress && job && (
        <p role="status">
          {pt(`jobStatus.${job.status}`)}{' '}
          {job.progress ? `${job.progress.completedSteps} / ${job.progress.totalSteps}` : ''}
        </p>
      )}
      {showJobProgress &&
        typeof job?.progress?.details?.translated === 'number' &&
        typeof job.progress.details.skipped === 'number' && (
          <p className="text-sm text-muted-foreground">
            {job.progress.details.locale ? `${languageName(job.progress.details.locale)} · ` : ''}
            {pt('translationProgress', {
              translated: job.progress.details.translated ?? 0,
              skipped: job.progress.details.skipped ?? 0,
              pending: job.progress.totalSteps - job.progress.completedSteps,
            })}
          </p>
        )}
      {job?.error && (
        <p role="alert" className="text-destructive">
          {pt(job.error)}
        </p>
      )}
    </>
  );
};
