import { Slot } from '@radix-ui/react-slot';
import { Pencil } from 'lucide-react';
import * as React from 'react';

import { Button, type ButtonProps } from './button.js';
import { useStudioTableLayout } from './studio-table-layout-context.js';
import { cn } from './utils.js';

export type StudioTableActionTone = 'default' | 'destructive';

export type StudioTableActionButtonProps = Omit<
  ButtonProps,
  'aria-label' | 'children' | 'size' | 'tooltip' | 'variant'
> &
  Readonly<{
    label: string;
    mobileLabel?: string;
    icon: React.ReactNode;
    tone?: StudioTableActionTone;
    children?: React.ReactElement;
  }>;

export const StudioTableActionButton = React.forwardRef<
  HTMLButtonElement,
  StudioTableActionButtonProps
>(
  (
    {
      asChild = false,
      children,
      className,
      icon,
      label,
      mobileLabel = label,
      tone = 'default',
      ...props
    },
    ref
  ) => {
    const layout = useStudioTableLayout();
    const compact = layout === 'compact';
    const content = (
      <>
        {icon}
        {compact ? <span>{mobileLabel}</span> : null}
      </>
    );
    const slottedChild =
      asChild && React.isValidElement<{ children?: React.ReactNode }>(children)
        ? React.cloneElement(children, undefined, content)
        : children;

    return (
      <Button
        ref={ref}
        asChild={asChild}
        type="button"
        variant="tertiary"
        size={compact ? undefined : 'icon'}
        aria-label={label}
        tooltip={compact ? undefined : label}
        className={cn(
          compact ? 'w-auto px-3' : 'rounded-md',
          tone === 'destructive' &&
            'text-action-destructive-foreground hover:border-action-destructive-border hover:bg-action-destructive-hover hover:text-action-destructive-foreground active:bg-action-destructive-active',
          className
        )}
        {...props}
      >
        {asChild ? slottedChild : content}
      </Button>
    );
  }
);
StudioTableActionButton.displayName = 'StudioTableActionButton';

export type StudioTableValueActionProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  Readonly<{
    asChild?: boolean;
    emphasis?: 'default' | 'primary';
    numeric?: boolean;
  }>;

export const StudioTableValueAction = React.forwardRef<
  HTMLButtonElement,
  StudioTableValueActionProps
>(
  (
    {
      asChild = false,
      className,
      emphasis = 'default',
      numeric = false,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          'inline-flex min-h-6 min-w-6 max-w-full items-start rounded-sm border-0 bg-transparent p-0 text-left text-primary underline-offset-4',
          'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:underline',
          'disabled:cursor-not-allowed disabled:text-action-disabled-foreground disabled:no-underline dark:text-action-focus',
          emphasis === 'primary' ? 'font-semibold' : 'font-medium',
          numeric && 'tabular-nums',
          className
        )}
        {...props}
      />
    );
  }
);
StudioTableValueAction.displayName = 'StudioTableValueAction';

export type StudioStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const statusToneClassNames: Readonly<Record<StudioStatusTone, string>> = {
  neutral: 'border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  info: 'border-sky-400 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  success:
    'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  warning: 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  danger: 'border-rose-400 bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
};

export type StudioStatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  Readonly<{
    editable?: boolean;
    tone?: StudioStatusTone;
  }>;

export const StudioStatusBadge = ({
  children,
  className,
  editable = false,
  tone = 'neutral',
  ...props
}: StudioStatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex min-h-6 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold',
      statusToneClassNames[tone],
      className
    )}
    data-editable={editable || undefined}
    {...props}
  >
    {children}
    {editable ? <Pencil aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
  </span>
);
