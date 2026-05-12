import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
type DialogOverlayElement = React.ComponentRef<typeof DialogPrimitive.Overlay>;
type DialogOverlayProps = React.ComponentProps<typeof DialogPrimitive.Overlay>;
type DialogContentElement = React.ComponentRef<typeof DialogPrimitive.Content>;
type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content>;
type DialogTitleElement = React.ComponentRef<typeof DialogPrimitive.Title>;
type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>;
type DialogDescriptionElement = React.ComponentRef<typeof DialogPrimitive.Description>;
type DialogDescriptionProps = React.ComponentProps<typeof DialogPrimitive.Description>;

const DialogOverlay = React.forwardRef<
  DialogOverlayElement,
  DialogOverlayProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  DialogContentElement,
  DialogContentProps
>(({ className, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus-visible:outline-none',
        className
      )}
      {...props}
    />
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-wrap justify-end gap-3', className)} {...props} />
);

const DialogTitle = React.forwardRef<
  DialogTitleElement,
  DialogTitleProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  DialogDescriptionElement,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
