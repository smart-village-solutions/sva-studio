import * as React from 'react';

import { cn } from './utils.js';

type CheckboxProps = React.ComponentProps<'input'> & Readonly<{ indeterminate?: boolean }>;

const setForwardedRef = (ref: React.ForwardedRef<HTMLInputElement>, element: HTMLInputElement | null) => {
  if (typeof ref === 'function') {
    ref(element);
    return;
  }
  if (ref) {
    ref.current = element;
  }
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, indeterminate = false, type, ...props }, ref) => {
  const { checked, defaultChecked, onChange, ...restProps } = props;
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(Boolean(defaultChecked));
  const visualChecked = typeof checked === 'boolean' ? checked : uncontrolledChecked;

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={(element) => {
        inputRef.current = element;
        setForwardedRef(ref, element);
      }}
      type={type ?? 'checkbox'}
      checked={checked}
      defaultChecked={defaultChecked}
      className={cn(
        [
          'relative h-[1.35rem] w-[1.35rem] appearance-none rounded-full border border-input bg-background bg-center bg-no-repeat',
          'bg-[length:0_0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] transition-[background-color,border-color,box-shadow,background-size,transform] duration-150 ease-out',
          'hover:border-primary/50 hover:ring-4 hover:ring-primary/10 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ring-0 disabled:active:scale-100',
          'motion-reduce:transition-none motion-reduce:active:scale-100',
          indeterminate
            ? 'border-primary bg-primary bg-[image:linear-gradient(white,white)] bg-[length:58%_14%] shadow-[0_0_0_4px_rgba(59,130,246,0.12)]'
            : visualChecked
              ? 'border-primary bg-primary shadow-[0_0_0_4px_rgba(59,130,246,0.12)]'
              : '',
        ],
        className
      )}
      style={
        indeterminate
          ? undefined
          : visualChecked
            ? {
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M3.5 8.5 6.5 11.5 12.5 5.5' stroke='white' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                backgroundSize: '68% 68%',
              }
            : undefined
      }
      onChange={(event) => {
        if (typeof checked !== 'boolean') {
          setUncontrolledChecked(event.currentTarget.checked);
        }
        onChange?.(event);
      }}
      {...restProps}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
