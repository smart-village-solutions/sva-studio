import React from 'react';
import { Button } from '@sva/studio-ui-react';

type SurveyResultVisibilityExportFormat = 'csv' | 'json' | 'excel' | 'xml';
type SurveyResultExportKind = 'withoutFreeText' | 'withFreeText';
type SurveyFreeTextStatus = 'INTERNAL' | 'PUBLIC';

export type SurveyResultsFreeTextResponse = Readonly<{
  id: string;
  text: string;
  status: SurveyFreeTextStatus;
  createdAt: string;
}>;

export type SurveyResultsOptionResult = Readonly<{
  optionId: string;
  title: string;
  votes: number;
  percentage?: number;
}>;

export type SurveyResultsQuestionResult = Readonly<{
  questionId: string;
  questionTitle: string;
  totalResponses: number;
  optionResults: readonly SurveyResultsOptionResult[];
  freeTextResponses: readonly SurveyResultsFreeTextResponse[];
}>;

export type SurveyResultsTabData = Readonly<{
  statusLabel: string;
  participationCount: number;
  submissionCount: number;
  questionCount: number;
  questions: readonly SurveyResultsQuestionResult[];
}>;

type ResultsTranslate = (key: string) => string;

const exportFormats: readonly SurveyResultVisibilityExportFormat[] = ['csv', 'json', 'excel', 'xml'];

const freeTextStatusLabelKey: Record<SurveyFreeTextStatus, string> = {
  INTERNAL: 'fields.freeTextStatusOptions.internal',
  PUBLIC: 'fields.freeTextStatusOptions.public',
};

const formatPercentage = (value?: number): string => (typeof value === 'number' ? `${value.toFixed(1)} %` : '--');

const progressWidth = (value?: number): string => `${Math.max(0, Math.min(100, value ?? 0))}%`;

function SurveyResultsSummaryCard({
  resultData,
  pt,
}: Readonly<{
  resultData: SurveyResultsTabData;
  pt: ResultsTranslate;
}>) {
  const metrics = [
    { label: pt('fields.summaryParticipationCount'), value: resultData.participationCount },
    { label: pt('fields.summarySubmissionCount'), value: resultData.submissionCount },
    { label: pt('fields.summaryQuestionCount'), value: resultData.questionCount },
    { label: pt('fields.summaryStatus'), value: resultData.statusLabel },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{pt('cards.results.summary.title')}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.results.summary.description')}</p>
      </div>
      <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <dt className="text-sm text-muted-foreground">{metric.label}</dt>
            <dd className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SurveyQuestionResultsList({
  questions,
  pt,
}: Readonly<{
  questions: readonly SurveyResultsQuestionResult[];
  pt: ResultsTranslate;
}>) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{pt('cards.results.questions.title')}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.results.questions.description')}</p>
      </div>
      <div className="mt-5 space-y-5 border-t border-border pt-5">
        {questions.map((question) => (
          <article key={question.questionId} className="space-y-4 rounded-lg border border-border/60 bg-background p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">{question.questionTitle}</h4>
              <p className="text-sm text-muted-foreground">{question.totalResponses} {pt('fields.summaryResponseCount')}</p>
            </div>

            {question.optionResults.length > 0 ? (
              <div className="space-y-3">
                {question.optionResults.map((option) => (
                  <div key={option.optionId} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{option.title}</span>
                      <span className="text-muted-foreground">
                        {option.votes} {pt('fields.optionVotes')} | {formatPercentage(option.percentage)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: progressWidth(option.percentage) }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{pt('messages.resultsQuestionEmpty')}</p>
            )}

            <details className="rounded-lg border border-border/60 bg-muted/10 p-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                {pt('fields.freeTextSection')}
              </summary>
              <div className="mt-4 space-y-3">
                {question.freeTextResponses.length > 0 ? (
                  question.freeTextResponses.map((response) => (
                    <div key={response.id} className="space-y-2 rounded-md border border-border/60 bg-background p-3">
                      <p className="text-sm text-foreground">{response.text}</p>
                      <dl className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                        <div className="space-y-1">
                          <dt>{pt('fields.freeTextStatus')}</dt>
                          <dd>{pt(freeTextStatusLabelKey[response.status])}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt>{pt('fields.freeTextCreatedAt')}</dt>
                          <dd>{response.createdAt}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{pt('messages.resultsFreeTextEmpty')}</p>
                )}
              </div>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

function SurveyResultsExportCard({
  pt,
  onExport,
}: Readonly<{
  pt: ResultsTranslate;
  onExport?: (input: { kind: SurveyResultExportKind; format: SurveyResultVisibilityExportFormat }) => void;
}>) {
  const sections: readonly { kind: SurveyResultExportKind; title: string; description: string }[] = [
    {
      kind: 'withoutFreeText',
      title: pt('labels.exportWithoutFreeText'),
      description: pt('messages.resultsExportWithoutFreeText'),
    },
    {
      kind: 'withFreeText',
      title: pt('labels.exportWithFreeText'),
      description: pt('messages.resultsExportWithFreeText'),
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{pt('cards.results.export.title')}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.results.export.description')}</p>
      </div>
      <div className="mt-5 space-y-4 border-t border-border pt-5">
        {sections.map((section) => (
          <div key={section.kind} className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {exportFormats.map((format) => (
                <Button
                  key={`${section.kind}-${format}`}
                  type="button"
                  variant="outline"
                  onClick={() => onExport?.({ kind: section.kind, format })}
                >
                  {pt(`labels.exportFormats.${format}`)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SurveyDetailResultsTab({
  mode,
  resultData,
  pt,
  onExport,
}: Readonly<{
  mode: 'create' | 'edit';
  resultData: SurveyResultsTabData | null;
  pt: ResultsTranslate;
  onExport?: (input: { kind: SurveyResultExportKind; format: SurveyResultVisibilityExportFormat }) => void;
}>) {
  if (mode === 'create' || !resultData) {
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{pt('cards.results.summary.title')}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.results.summary.description')}</p>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">{pt('messages.createPendingHint')}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SurveyResultsSummaryCard resultData={resultData} pt={pt} />
      <SurveyQuestionResultsList questions={resultData.questions} pt={pt} />
      {onExport ? <SurveyResultsExportCard pt={pt} onExport={onExport} /> : null}
    </div>
  );
}
