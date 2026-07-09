import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils.js';

const buttonVariants = cva(
  'animate-button-hover inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15',
        outline: 'border border-border bg-background text-foreground hover:bg-muted',
        secondary: 'bg-secondary/10 text-secondary hover:bg-secondary/15',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
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
  const triggerChild =
    React.isValidElement(children) && typeof children.type !== 'symbol'
      ? React.cloneElement(children, {
          'aria-describedby': open ? tooltipId : undefined,
        } as Record<string, unknown>)
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
  ({ children, className, variant, size, asChild = false, tooltip, title, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const buttonNode = (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        title={tooltip ? undefined : title}
        {...props}
      >
        {children}
      </Comp>
    );

    return tooltip ? <IconButtonTooltip label={tooltip}>{buttonNode}</IconButtonTooltip> : buttonNode;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
