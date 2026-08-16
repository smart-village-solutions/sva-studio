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
  variant = 'secondary',
  size = 'sm',
  className,
  children,
  unstyled = false,
  showExternalIcon = true,
}: {
  readonly search: WasteManagementSearchParams;
  readonly tourId: string;
  readonly originalDate?: string;
  readonly label: string;
  readonly variant?: ButtonProps['variant'];
  readonly size?: ButtonProps['size'];
  readonly className?: string;
  readonly children?: ReactNode;
  readonly unstyled?: boolean;
  readonly showExternalIcon?: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Link
      to="/plugins/waste-management"
      search={toCreateTourShiftSearch(search, { tourId, originalDate })}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} ${pt('tours.actions.opensInNewTab')}`}
      className={unstyled ? className : cn(buttonVariants({ variant, size }), className)}
    >
      {children ?? <span>{label}</span>}
      {showExternalIcon ? <IconExternalLink aria-hidden="true" className="h-4 w-4" /> : null}
    </Link>
  );
};
