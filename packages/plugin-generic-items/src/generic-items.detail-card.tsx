import { StudioDetailCard } from '@sva/studio-ui-react';
import React from 'react';

export const GenericItemsDetailCard = ({
  title,
  description,
  children,
  collapsible = false,
  summary,
  invalid = false,
}: Readonly<{
  title: string;
  collapsible?: boolean;
  summary?: string;
  invalid?: boolean;
  description?: string;
  children: React.ReactNode;
}>) => {
  const details = React.useRef<HTMLDetailsElement>(null);
  React.useLayoutEffect(() => {
    if (invalid && details.current) details.current.open = true;
  }, [invalid]);
  return collapsible ? (
    <details
      ref={details}
      className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 sm:p-6"
    >
      <summary className="cursor-pointer text-sm font-medium">
        {title}
        {summary ? ` — ${summary}` : ''}
      </summary>
      {description ? <p>{description}</p> : null}
      {children}
    </details>
  ) : (
    <StudioDetailCard title={title} description={description}>
      {children}
    </StudioDetailCard>
  );
};
