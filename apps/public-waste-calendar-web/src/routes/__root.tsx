import type { ReactNode } from 'react';

export function PublicWasteRootDocument({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="page-shell">
      <header className="hero">
        <p className="hero__eyebrow">SVA Public Waste Calendar</p>
        <h1 className="hero__title">Abfallkalender</h1>
      </header>
      {children}
    </div>
  );
}
