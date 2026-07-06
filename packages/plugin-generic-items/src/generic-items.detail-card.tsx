import type React from 'react';

export const GenericItemsDetailCard = ({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>) => (
  <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-5">
    <header className="space-y-1">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </header>
    <div className="space-y-4">{children}</div>
  </section>
);
