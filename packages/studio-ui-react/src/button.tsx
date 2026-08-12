import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils.js';

const buttonVariants = cva(
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-action-disabled-border disabled:bg-action-disabled disabled:text-action-disabled-foreground disabled:opacity-100 disabled:hover:border-action-disabled-border disabled:hover:bg-action-disabled disabled:hover:text-action-disabled-foreground aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:border-action-disabled-border aria-disabled:bg-action-disabled aria-disabled:text-action-disabled-foreground',
  {
    variants: {
      variant: {
        primary:
          'border-action-primary bg-action-primary text-action-primary-foreground hover:border-action-primary-hover hover:bg-action-primary-hover active:border-action-primary-active active:bg-action-primary-active',
        secondary:
          'border-action-secondary-border bg-action-secondary text-action-secondary-foreground hover:bg-action-secondary-hover active:bg-action-secondary-active',
        tertiary:
          'border-transparent bg-transparent text-action-tertiary-foreground hover:border-action-tertiary-hover hover:bg-action-tertiary-hover hover:text-action-tertiary-hover-foreground active:border-action-tertiary-active active:bg-action-tertiary-active active:text-action-tertiary-active-foreground',
        destructive:
          'border-action-destructive-border bg-action-destructive text-action-destructive-foreground hover:bg-action-destructive-hover active:bg-action-destructive-active',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1.5',
        icon: 'h-11 w-11 min-w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    tooltip?: string;
  };

const IconButtonTooltip = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) => {
  const [open, setOpen] = React.useState(false);
  const tooltipId = React.useId();
  const triggerChild = React.isValidElement<{ 'aria-describedby'?: string }>(children)
    ? React.cloneElement(children, {
        'aria-describedby':
          [children.props['aria-describedby'], open ? tooltipId : undefined]
            .filter(Boolean)
            .join(' ') || undefined,
      })
    : children;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      {triggerChild}
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      tooltip,
      title,
      disabled = false,
      onClick,
      tabIndex,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (asChild && isDisabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick?.(event);
    };
    const buttonNode = (
      <Comp
        ref={ref}
        {...props}
        aria-busy={loading || undefined}
        aria-disabled={asChild && isDisabled ? true : undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        data-loading={loading || undefined}
        disabled={asChild ? undefined : isDisabled}
        onClick={handleClick}
        tabIndex={asChild && isDisabled ? -1 : tabIndex}
        title={tooltip ? undefined : title}
      >
        {children}
      </Comp>
    );

    return tooltip ? (
      <IconButtonTooltip label={tooltip}>{buttonNode}</IconButtonTooltip>
    ) : (
      buttonNode
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
