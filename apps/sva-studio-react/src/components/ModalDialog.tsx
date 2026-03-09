import React from 'react';

type ModalDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly role?: 'dialog' | 'alertdialog';
  readonly onClose: () => void;
  readonly children: React.ReactNode;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export const ModalDialog = ({
  open,
  title,
  description,
  role = 'dialog',
  onClose,
  children,
}: ModalDialogProps) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const previousOpenRef = React.useRef(false);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
      const first = focusables[0];
      first?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
};
