import * as React from 'react';

export type StudioTableLayout = 'standalone' | 'wide' | 'compact';

const StudioTableLayoutContext = React.createContext<StudioTableLayout>('standalone');

export const StudioTableLayoutProvider = ({
  children,
  layout,
}: Readonly<{
  children: React.ReactNode;
  layout: StudioTableLayout;
}>) => (
  <StudioTableLayoutContext.Provider value={layout}>{children}</StudioTableLayoutContext.Provider>
);

export const useStudioTableLayout = (): StudioTableLayout =>
  React.useContext(StudioTableLayoutContext);
