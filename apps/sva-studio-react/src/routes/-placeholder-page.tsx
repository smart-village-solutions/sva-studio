import { t } from '../i18n';

type PlaceholderPageProps = Readonly<{
  section: string;
  title: string;
}>;

export const PlaceholderPage = ({ section, title }: PlaceholderPageProps) => {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {t('placeholder.eyebrow')}
        </p>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{section}</p>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t('placeholder.description', { area: title })}
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,1fr)]">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-shell">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {t('placeholder.statusLabel')}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {t('placeholder.statusValue')}
            </span>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('placeholder.body', { area: title })}
          </p>
        </article>

        <aside className="rounded-2xl border border-dashed border-border bg-card/70 p-6 shadow-shell">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('placeholder.nextStepLabel')}
          </p>
          <h2 className="mt-3 text-xl font-semibold text-foreground">{t('placeholder.nextStepTitle')}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t('placeholder.nextStepBody', { area: title })}
          </p>
        </aside>
      </div>
    </section>
  );
};
