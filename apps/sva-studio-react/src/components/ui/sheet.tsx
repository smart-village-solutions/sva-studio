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

export const Sheet = ({ open, onOpenChange, children }: SheetProps) => (
  <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>
);

export const SheetContent = ({ children, className = '', side = 'left', 'aria-label': ariaLabel }: SheetContentProps) => {
  const context = React.useContext(SheetContext);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  if (!context) {
    throw new Error('SheetContent must be used inside Sheet');
  }

  const { open, onOpenChange } = context;

  React.useEffect(() => {
    if (!open) {
      if (triggerRef.current?.isConnected) {
        triggerRef.current.focus();
      }
      return;
    }

    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onOpenChange(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={false}>
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label={ariaLabel}
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
