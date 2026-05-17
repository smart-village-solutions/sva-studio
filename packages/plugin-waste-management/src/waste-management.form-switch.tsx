import { cn } from '@sva/studio-ui-react';

export const WasteManagementFormSwitch = ({
  checked,
  disabled = false,
  ariaLabel,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly ariaLabel: string;
  readonly onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-60',
      checked ? 'bg-primary' : 'bg-muted'
    )}
    onClick={() => onChange(!checked)}
  >
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0.5'
      )}
    />
  </button>
);
