import { StudioDetailCard } from '@sva/studio-ui-react';
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
  <StudioDetailCard title={title} description={description}>
    {children}
  </StudioDetailCard>
);
