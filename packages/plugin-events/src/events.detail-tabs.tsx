import type React from 'react';

type EventsTabIconProps = Readonly<{ className?: string }>;

const EventsTabBasisIcon = ({ className }: EventsTabIconProps) => (
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

const EventsTabContentIcon = ({ className }: EventsTabIconProps) => (
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

const EventsTabSettingsIcon = ({ className }: EventsTabIconProps) => (
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

const EventsTabHistoryIcon = ({ className }: EventsTabIconProps) => (
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

export const eventsTabIconMap = {
  basis: EventsTabBasisIcon,
  content: EventsTabContentIcon,
  settings: EventsTabSettingsIcon,
  history: EventsTabHistoryIcon,
} as const satisfies Record<EventsDetailTabId, (props: EventsTabIconProps) => React.JSX.Element>;

export type EventsDetailTabId = 'basis' | 'content' | 'settings' | 'history';

export type EventsDetailTabDefinition = Readonly<{
  id: EventsDetailTabId;
  label: string;
  title: string;
  description: string;
}>;

export const createEventsDetailTabDefinitions = (
  pt: (key: string) => string
): readonly EventsDetailTabDefinition[] => [
  {
    id: 'basis',
    label: pt('detailTabs.basis.title'),
    title: pt('detailTabs.basis.title'),
    description: pt('detailTabs.basis.description'),
  },
  {
    id: 'content',
    label: pt('detailTabs.content.title'),
    title: pt('detailTabs.content.title'),
    description: pt('detailTabs.content.description'),
  },
  {
    id: 'settings',
    label: pt('detailTabs.settings.title'),
    title: pt('detailTabs.settings.title'),
    description: pt('detailTabs.settings.description'),
  },
  {
    id: 'history',
    label: pt('detailTabs.history.title'),
    title: pt('detailTabs.history.title'),
    description: pt('detailTabs.history.description'),
  },
];
