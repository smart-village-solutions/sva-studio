import * as React from 'react';

import { Button, type ButtonProps } from './button.js';
import { cn } from './utils.js';

export type StudioActionMenuItem = Readonly<{
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  onSelect?: () => void;
  render?: React.ReactNode;
}>;

export type StudioActionMenuProps = Readonly<{
  items: readonly StudioActionMenuItem[];
  className?: string;
}>;

export function StudioActionMenu({ items, className }: StudioActionMenuProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) =>
        item.render ? (
          <React.Fragment key={item.id}>{item.render}</React.Fragment>
        ) : (
          <Button
            key={item.id}
            type="button"
            variant={item.variant ?? 'outline'}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            {item.icon}
            {item.label}
          </Button>
        )
      )}
    </div>
  );
}
