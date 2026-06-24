import type React from 'react';

export function EventsDetailCard({
  title,
  description,
  actions,
  children,
}: Readonly<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
