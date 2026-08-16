import { Link } from '@tanstack/react-router';
import { IconExternalLink } from '@tabler/icons-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { buttonVariants, cn, type ButtonProps } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

import type { WasteManagementSearchParams } from './search-params.js';
import { toCreateTourShiftSearch } from './waste-management.tour-shift-navigation.js';

export const WasteTourShiftCreateLink = ({
  search,
  tourId,
  originalDate,
  label,
  accessibleLabel = label,
  variant = 'secondary',
  size = 'sm',
  className,
  children,
  unstyled = false,
  showExternalIcon = true,
  disabled = false,
  disabledDescription,
}: {
  readonly search: WasteManagementSearchParams;
  readonly tourId: string;
  readonly originalDate?: string;
  readonly label: string;
  readonly accessibleLabel?: string;
  readonly variant?: ButtonProps['variant'];
  readonly size?: ButtonProps['size'];
  readonly className?: string;
  readonly children?: ReactNode;
  readonly unstyled?: boolean;
  readonly showExternalIcon?: boolean;
  readonly disabled?: boolean;
  readonly disabledDescription?: string;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  const content = (
    <>
      {children ?? <span>{label}</span>}
      {showExternalIcon ? <IconExternalLink aria-hidden="true" className="h-4 w-4" /> : null}
      {disabledDescription ? <span className="sr-only"> {disabledDescription}</span> : null}
    </>
  );
  const linkClassName = unstyled ? className : cn(buttonVariants({ variant, size }), className);

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${accessibleLabel}. ${disabledDescription ?? ''}`.trim()}
        className={cn(linkClassName, 'cursor-not-allowed opacity-60')}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      to="/plugins/waste-management"
      search={toCreateTourShiftSearch(search, { tourId, originalDate })}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${accessibleLabel} ${pt('tours.actions.opensInNewTab')}`}
      className={linkClassName}
    >
      {content}
    </Link>
  );
};
