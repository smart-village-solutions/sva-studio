import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
type AlertDialogOverlayElement = React.ComponentRef<typeof AlertDialogPrimitive.Overlay>;
type AlertDialogOverlayProps = React.ComponentProps<typeof AlertDialogPrimitive.Overlay>;
type AlertDialogContentElement = React.ComponentRef<typeof AlertDialogPrimitive.Content>;
type AlertDialogContentProps = React.ComponentProps<typeof AlertDialogPrimitive.Content>;
type AlertDialogTitleElement = React.ComponentRef<typeof AlertDialogPrimitive.Title>;
type AlertDialogTitleProps = React.ComponentProps<typeof AlertDialogPrimitive.Title>;
type AlertDialogDescriptionElement = React.ComponentRef<typeof AlertDialogPrimitive.Description>;
type AlertDialogDescriptionProps = React.ComponentProps<typeof AlertDialogPrimitive.Description>;
type AlertDialogActionElement = React.ComponentRef<typeof AlertDialogPrimitive.Action>;
type AlertDialogActionProps = React.ComponentProps<typeof AlertDialogPrimitive.Action>;
type AlertDialogCancelElement = React.ComponentRef<typeof AlertDialogPrimitive.Cancel>;
type AlertDialogCancelProps = React.ComponentProps<typeof AlertDialogPrimitive.Cancel>;

const AlertDialogOverlay = React.forwardRef<
  AlertDialogOverlayElement,
  AlertDialogOverlayProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]', className)}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  AlertDialogContentElement,
  AlertDialogContentProps
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-2xl focus-visible:outline-none',
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />
);

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex flex-wrap justify-end gap-3', className)} {...props} />
);

const AlertDialogTitle = React.forwardRef<
  AlertDialogTitleElement,
  AlertDialogTitleProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  AlertDialogDescriptionElement,
  AlertDialogDescriptionProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  AlertDialogActionElement,
  AlertDialogActionProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants({ variant: 'destructive' }), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  AlertDialogCancelElement,
  AlertDialogCancelProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
};
