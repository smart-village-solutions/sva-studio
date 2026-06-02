import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/utils';

type StudioTableSurfaceProps = Readonly<{
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  tone?: 'background' | 'card';
}> &
  Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export const StudioTableSurface = ({
  children,
  className,
  scrollClassName,
  tone = 'card',
  ...props
}: StudioTableSurfaceProps) => (
  <div
    className={cn(
      'overflow-hidden rounded-none border-y border-border shadow-shell',
      tone === 'background' ? 'bg-background' : 'bg-card',
      className
    )}
    {...props}
  >
    <div className={cn('overflow-x-auto', scrollClassName)}>{children}</div>
  </div>
);
