import React from 'react';

type SheetContextValue = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

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

const SheetContext = React.createContext<SheetContextValue | null>(null);

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const getSheetPositionClasses = (side: 'left' | 'right'): string => {
  if (side === 'right') {
    return 'right-0 border-l';
  }

  return 'left-0 border-r';
};

export const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  const value = React.useMemo(() => ({ open, onOpenChange }), [open, onOpenChange]);
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
};

export const SheetContent = ({
  children,
  className = '',
  closeLabel = 'Close',
  side = 'left',
  'aria-label': ariaLabel,
}: SheetContentProps) => {
  const context = React.useContext(SheetContext);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const previousOpenRef = React.useRef(false);
  const onOpenChangeRef = React.useRef<(open: boolean) => void>(() => undefined);

  if (!context) {
    throw new Error('SheetContent must be used inside Sheet');
  }

  const { open, onOpenChange } = context;

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (!open) {
      if (wasOpen && triggerRef.current?.isConnected) {
        triggerRef.current.focus();
      }
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (!wasOpen) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusables[0]?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentFocusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (currentFocusables.length === 0) {
        return;
      }

      const firstFocusable = currentFocusables[0];
      const lastFocusable = currentFocusables[currentFocusables.length - 1];

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={false}>
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label={closeLabel}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`absolute top-0 h-full w-[18rem] border-border bg-sidebar shadow-shell ${getSheetPositionClasses(side)} ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
};
