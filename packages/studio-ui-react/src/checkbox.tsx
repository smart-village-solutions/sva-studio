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
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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
      className={cn(
        'h-4 w-4 rounded border border-input bg-background text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
