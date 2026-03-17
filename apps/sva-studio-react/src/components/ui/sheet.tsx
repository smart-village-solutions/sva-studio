import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';

type SheetProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}>;

type SheetContentProps = Readonly<{
  children: React.ReactNode;
  className?: string;
  closeLabel?: string;
  side?: 'left' | 'right';
  'aria-label': string;
}>;

const getSheetPositionClasses = (side: 'left' | 'right') => {
  if (side === 'right') {
    return 'right-0 border-l';
  }

  return 'left-0 border-r';
};

export const Sheet = ({ open, onOpenChange, children }: SheetProps) => (
  <SheetRoot open={open} onOpenChange={onOpenChange}>
    {children}
  </SheetRoot>
);

const SheetRoot = ({ open, onOpenChange, children }: SheetProps) => {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const previousOpenRef = React.useRef(false);

  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (open && !wasOpen) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }

    if (!open && wasOpen && triggerRef.current?.isConnected) {
      triggerRef.current.focus();
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
};

export const SheetContent = ({
  children,
  className = '',
  closeLabel = 'Close',
  side = 'left',
  'aria-label': ariaLabel,
}: SheetContentProps) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 lg:hidden" />
    <DialogPrimitive.Close
      aria-label={closeLabel}
      className="fixed inset-0 z-50 cursor-default lg:hidden"
      data-slot="sheet-close-overlay"
      tabIndex={-1}
      type="button"
    />
    <DialogPrimitive.Content
      aria-label={ariaLabel}
      aria-describedby={undefined}
      className={cn(
        'fixed top-0 z-50 h-full w-[18rem] border-border bg-sidebar shadow-shell focus-visible:outline-none lg:hidden',
        getSheetPositionClasses(side),
        className
      )}
    >
      <DialogPrimitive.Title className="sr-only">{ariaLabel}</DialogPrimitive.Title>
      <div className="h-full">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);
