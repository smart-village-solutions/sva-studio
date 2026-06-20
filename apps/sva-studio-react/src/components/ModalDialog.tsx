import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';

type ModalDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly role?: 'dialog' | 'alertdialog';
  readonly overlayClassName?: string;
  readonly contentClassName?: string;
  readonly headerClassName?: string;
  readonly titleClassName?: string;
  readonly descriptionClassName?: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
};

export const ModalDialog = ({
  open,
  title,
  description,
  role = 'dialog',
  overlayClassName,
  contentClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  onClose,
  children,
}: ModalDialogProps) => {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const previousOpenRef = React.useRef(false);
  const overlayCloseRef = React.useRef(false);

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

  const handleCloseAutoFocus = React.useCallback((event: Event) => {
    if (!triggerRef.current?.isConnected) {
      return;
    }
    event.preventDefault();
    triggerRef.current.focus();
  }, []);

  const requestClose = React.useCallback(() => {
    overlayCloseRef.current = true;
    onClose();
  }, [onClose]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        overlayCloseRef.current = false;
        return;
      }
      if (overlayCloseRef.current) {
        overlayCloseRef.current = false;
        return;
      }
      onClose();
    },
    [onClose]
  );

  const contentAccessibilityProps = description
    ? {}
    : ({
        'aria-describedby': undefined,
      } satisfies Pick<React.ComponentProps<typeof DialogPrimitive.Content>, 'aria-describedby'>);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] animate-modal-overlay', overlayClassName)}
          onClick={requestClose}
        />
        <DialogPrimitive.Content
          {...contentAccessibilityProps}
          role={role}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-2xl focus-visible:outline-none animate-modal-content',
            contentClassName
          )}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <header className={cn('mb-4', headerClassName)}>
            <DialogPrimitive.Title className={cn('text-lg font-semibold text-foreground', titleClassName)}>
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className={cn('mt-1 text-sm text-muted-foreground', descriptionClassName)}>
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
