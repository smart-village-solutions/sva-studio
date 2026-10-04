import * as React from 'react';

import { cn } from './utils.js';

const StudioPageTitleAccessoryContext = React.createContext<React.ReactNode>(null);

export type StudioPageTitleAccessoryProviderProps = Readonly<{
  accessory: React.ReactNode;
  children: React.ReactNode;
}>;

export function StudioPageTitleAccessoryProvider({
  accessory,
  children,
}: StudioPageTitleAccessoryProviderProps) {
  return (
    <StudioPageTitleAccessoryContext.Provider value={accessory}>
      {children}
    </StudioPageTitleAccessoryContext.Provider>
  );
}

export type StudioPageTitleProps = React.ComponentPropsWithoutRef<'h1'> &
  Readonly<{
    withAccessory?: boolean;
  }>;

export function StudioPageTitle({
  className,
  withAccessory = false,
  ...props
}: StudioPageTitleProps) {
  const accessory = React.useContext(StudioPageTitleAccessoryContext);

  return (
    <div className="inline-flex max-w-full min-w-0 items-center gap-1">
      <h1 className={cn('text-3xl font-semibold text-foreground', className)} {...props} />
      {withAccessory && accessory ? <div className="shrink-0">{accessory}</div> : null}
    </div>
  );
}

export type StudioPageHeaderProps = Readonly<{
  title: React.ReactNode;
  titleId?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  withTitleAccessory?: boolean;
  className?: string;
}>;

export function StudioPageHeader({
  title,
  titleId,
  description,
  actions,
  withTitleAccessory = false,
  className,
}: StudioPageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between', className)}
    >
      <div className="space-y-2">
        <StudioPageTitle id={titleId} withAccessory={withTitleAccessory}>
          {title}
        </StudioPageTitle>
        {description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-start gap-2">{actions}</div> : null}
    </header>
  );
}
