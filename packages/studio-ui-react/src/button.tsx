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

type SlottedButtonChildProps = {
  onClick?: React.MouseEventHandler<HTMLElement>;
  title?: string;
  'aria-label'?: string;
};

const preventSlottedActivation: React.MouseEventHandler<HTMLElement> = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const getSlottedButtonChild = (children: React.ReactNode) =>
  React.isValidElement<SlottedButtonChildProps>(children) ? children : null;

const resolveButtonTooltip = ({
  asChild,
  child,
  label,
  size,
  title,
  tooltip,
}: {
  readonly asChild: boolean;
  readonly child: React.ReactElement<SlottedButtonChildProps> | null;
  readonly label: string | undefined;
  readonly size: ButtonProps['size'];
  readonly title: string | undefined;
  readonly tooltip: string | undefined;
}) => {
  if (tooltip || (size !== 'icon' && size !== 'sm')) {
    return tooltip;
  }

  return asChild
    ? (child?.props.title ?? child?.props['aria-label'])
    : (title ?? label);
};

const enhanceSlottedButtonChild = ({
  asChild,
  child,
  children,
  disabled,
  tooltip,
}: {
  readonly asChild: boolean;
  readonly child: React.ReactElement<SlottedButtonChildProps> | null;
  readonly children: React.ReactNode;
  readonly disabled: boolean;
  readonly tooltip: string | undefined;
}) => {
  if (!asChild || !child || (!disabled && !tooltip)) {
    return children;
  }

  return React.cloneElement(child, {
    ...(disabled ? { onClick: preventSlottedActivation } : {}),
    ...(tooltip ? { title: undefined } : {}),
  });
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
    const disabledAsChild = asChild && isDisabled;
    const slottedChild = getSlottedButtonChild(children);
    const resolvedTooltip = resolveButtonTooltip({
      asChild,
      child: slottedChild,
      label: props['aria-label'],
      size,
      title,
      tooltip,
    });
    const renderedChildren = enhanceSlottedButtonChild({
      asChild,
      child: slottedChild,
      children,
      disabled: disabledAsChild,
      tooltip: resolvedTooltip,
    });
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (disabledAsChild) {
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
        aria-disabled={disabledAsChild ? true : undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        data-loading={loading || undefined}
        disabled={asChild ? undefined : isDisabled}
        onClick={handleClick}
        tabIndex={disabledAsChild ? -1 : tabIndex}
        title={resolvedTooltip ? undefined : title}
      >
        {renderedChildren}
      </Comp>
    );

    return resolvedTooltip ? (
      <IconButtonTooltip label={resolvedTooltip}>{buttonNode}</IconButtonTooltip>
    ) : (
      buttonNode
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
