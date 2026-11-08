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
      <h1
        className={cn(
          'min-w-0 break-words text-3xl font-semibold leading-9 text-foreground',
          className
        )}
        {...props}
      />
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
    <header className={cn('@container', className)}>
      <div className="flex min-w-0 flex-col gap-4 @min-[880px]:flex-row @min-[880px]:items-start @min-[880px]:justify-between">
        <div className="min-w-0 space-y-2">
          <StudioPageTitle id={titleId} withAccessory={withTitleAccessory}>
            {title}
          </StudioPageTitle>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex max-w-full flex-wrap items-start gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
