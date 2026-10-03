import type { StudioDetailTabDefinition } from '@sva/studio-ui-react';
import type { NewsDetailTabId } from './news.types.js';

export const createNewsDetailTabDefinitions = (
  tabs: readonly StudioDetailTabDefinition<NewsDetailTabId>[]
) => tabs;

import * as React from 'react';

type NewsTabIconProps = Readonly<{ className?: string }>;

const NewsTabBasisIcon = ({ className }: NewsTabIconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path d="M7 4.75h7.5L19 9.25v9A1.75 1.75 0 0 1 17.25 20h-10.5A1.75 1.75 0 0 1 5 18.25v-11.5A1.75 1.75 0 0 1 6.75 5Z" />
    <path d="M14 4.75v4.5h4.5" />
    <path d="M8.5 12h7" />
    <path d="M8.5 15.5h7" />
  </svg>
);

const NewsTabContentIcon = ({ className }: NewsTabIconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <rect x="4.5" y="5" width="15" height="14" rx="2" />
    <path d="m8 14 2.5-2.5 2 2 2.5-3 3 4.5" />
    <circle cx="9" cy="9.5" r="1.2" />
  </svg>
);

const NewsTabSettingsIcon = ({ className }: NewsTabIconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path d="M4 7h10" />
    <path d="M4 17h16" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
);

const NewsTabHistoryIcon = ({ className }: NewsTabIconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 5.5v3.7h3.7" />
    <path d="M12 8.5v4l2.5 1.5" />
  </svg>
);

export const newsTabIconMap = {
  basis: NewsTabBasisIcon,
  content: NewsTabContentIcon,
  settings: NewsTabSettingsIcon,
  history: NewsTabHistoryIcon,
} as const satisfies Record<NewsDetailTabId, (props: NewsTabIconProps) => React.JSX.Element>;
