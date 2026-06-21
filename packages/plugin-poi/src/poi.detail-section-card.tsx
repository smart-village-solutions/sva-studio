import type React from 'react';

export function PoiDetailSectionCard({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: string; children: React.ReactNode }>) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
