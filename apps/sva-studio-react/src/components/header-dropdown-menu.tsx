import React from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '../lib/utils';

export type HeaderDropdownItem = Readonly<{
  id: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  href?: string;
  documentNavigation?: boolean;
  render?: React.ReactNode;
}>;

export const HeaderSectionDivider = () => <hr className="my-1 border-border" />;

export const HeaderDropdownMenu = ({
  trigger,
  items,
  align = 'right',
  menuLabel,
  className,
  menuClassName,
  popupRole,
}: {
  readonly trigger: (props: {
    readonly open: boolean;
    readonly toggle: () => void;
    readonly menuId: string;
  }) => React.ReactNode;
  readonly items: readonly HeaderDropdownItem[];
  readonly align?: 'left' | 'right';
  readonly menuLabel: string;
  readonly className?: string;
  readonly menuClassName?: string;
  readonly popupRole?: 'dialog' | 'menu';
}) => {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const menuId = React.useId();
  const resolvedPopupRole = popupRole ?? 'menu';

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    globalThis.addEventListener('mousedown', handlePointerDown);
    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.removeEventListener('mousedown', handlePointerDown);
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((current) => !current), menuId })}
      {open ? (
        <div
          id={menuId}
          role={resolvedPopupRole}
          aria-label={menuLabel}
          aria-orientation={resolvedPopupRole === 'menu' ? 'vertical' : undefined}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-lg border border-border bg-popover p-1.5 shadow-md',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName
          )}
        >
          {items.map((item) => {
            if (item.render) {
              return <React.Fragment key={item.id}>{item.render}</React.Fragment>;
            }

            const itemClassName = cn(
              'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground',
              item.active && 'bg-accent text-accent-foreground',
              item.disabled && 'pointer-events-none opacity-50'
            );
            const content = (
              <>
                {item.icon ? (
                  <span className="mt-0.5 text-base leading-none">{item.icon}</span>
                ) : null}
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
              </>
            );

            if (item.href && item.documentNavigation) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  aria-disabled={item.disabled ? 'true' : undefined}
                  className={itemClassName}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              );
            }

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  role="menuitem"
                  aria-disabled={item.disabled ? 'true' : undefined}
                  className={itemClassName}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-disabled={item.disabled ? 'true' : undefined}
                className={itemClassName}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
