import { Button, type ButtonProps } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

type WastePendingSaveButtonProps = Omit<ButtonProps, 'children'> &
  Readonly<{
    label: ReactNode;
    saving: boolean;
  }>;

/**
 * Save-Button für untergeordnete Dialoge, die nach Erfolg schließen und das
 * Ergebnis unmittelbar in ihrer Elternliste zeigen. Deshalb besitzt der
 * Dialog selbst keinen sichtbaren `saved`-Zustand.
 */
export const WastePendingSaveButton = ({
  label,
  saving,
  disabled,
  ...props
}: WastePendingSaveButtonProps) => (
  <Button {...props} disabled={disabled || saving} loading={saving}>
    {label}
  </Button>
);
