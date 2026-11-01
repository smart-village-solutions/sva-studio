import { DayPicker, type DayPickerProps, type ChevronProps } from 'react-day-picker';

import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

import { buttonVariants } from './button.js';
import { cn } from './utils.js';

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon =
    orientation === 'left'
      ? ChevronLeft
      : orientation === 'right'
        ? ChevronRight
        : orientation === 'up'
          ? ChevronUp
          : ChevronDown;
  return <Icon aria-hidden="true" strokeWidth={1} className={className} />;
}

// shadcn Calendar composition; DayPicker owns the date grid and keyboard behavior.
export function Calendar({ className, classNames, components, ...props }: DayPickerProps) {
  const dayButton = cn(
    buttonVariants({ variant: 'tertiary' }),
    'h-11 w-9 min-h-11 min-w-9 p-0 font-medium sm:w-11 sm:min-w-11'
  );
  return (
    <DayPicker
      showOutsideDays
      navLayout="around"
      className={cn('w-fit bg-popover p-3 text-popover-foreground', className)}
      classNames={{
        months: 'relative',
        month: 'space-y-2',
        month_caption: 'flex h-11 items-center justify-center px-11',
        caption_label: 'text-sm font-medium',
        button_previous: cn(dayButton, 'absolute left-0 top-0'),
        button_next: cn(dayButton, 'absolute right-0 top-0'),
        chevron: 'h-5 w-5',
        month_grid: 'border-collapse',
        weekday: 'h-8 w-9 sm:w-11 text-center text-xs font-normal text-muted-foreground',
        day: 'h-11 w-9 sm:w-11 p-0 text-center',
        day_button: dayButton,
        selected:
          '[&>button]:border-action-primary [&>button]:bg-action-primary [&>button]:text-action-primary-foreground',
        today: '[&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4',
        outside: 'text-muted-foreground',
        disabled:
          '[&>button]:cursor-not-allowed [&>button]:text-muted-foreground [&>button]:opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{ Chevron: CalendarChevron, ...components }}
      {...props}
    />
  );
}
