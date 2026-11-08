import {
  IconCalendarClock as CalendarClock,
  IconDatabase as Database,
  IconMapPin as MapPin,
  IconRecycle as Recycle,
  IconRoute as Route,
  IconChartBar as ChartColumn,
  IconFileText as FileText,
  IconHistory as History,
  IconPhoto as Images,
  IconShieldCheck as ShieldCheck,
  IconAdjustmentsHorizontal as SlidersHorizontal,
} from '@tabler/icons-react';

import { cn } from './utils.js';

export type StudioDetailTabIconName =
  | 'basis'
  | 'content'
  | 'settings'
  | 'moderation'
  | 'results'
  | 'history'
  | 'calendarClock'
  | 'database'
  | 'mapPin'
  | 'recycle'
  | 'route';

const studioDetailTabIcons = {
  calendarClock: CalendarClock,
  database: Database,
  mapPin: MapPin,
  recycle: Recycle,
  route: Route,
  basis: FileText,
  content: Images,
  settings: SlidersHorizontal,
  moderation: ShieldCheck,
  results: ChartColumn,
  history: History,
} as const satisfies Record<StudioDetailTabIconName, typeof FileText>;

export function StudioDetailTabIcon({
  name,
  className,
}: Readonly<{ name: StudioDetailTabIconName; className?: string }>) {
  const Icon = studioDetailTabIcons[name];

  return <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', className)} />;
}
