import type { ReactNode } from 'react';

export function PublicWasteRootDocument({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="page-shell">{children}</div>;
}
