import { DayPicker, type DayPickerProps } from 'react-day-picker';

import { buttonVariants } from './button.js';
import { cn } from './utils.js';

// shadcn Calendar composition; DayPicker owns the date grid and keyboard behavior.
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  const dayButton = cn(
    buttonVariants({ variant: 'tertiary' }),
    'h-10 w-10 min-h-10 min-w-10 p-0 font-normal'
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
        chevron: 'h-4 w-4 fill-current',
        month_grid: 'border-collapse',
        weekday: 'h-8 w-10 text-center text-xs font-normal text-muted-foreground',
        day: 'h-10 w-10 p-0 text-center',
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
      {...props}
    />
  );
}
