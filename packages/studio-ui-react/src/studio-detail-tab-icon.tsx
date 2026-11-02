import {
  CalendarClock,
  Database,
  MapPin,
  Recycle,
  Route,
  ChartColumn,
  FileText,
  History,
  Images,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

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

  return <Icon aria-hidden="true" strokeWidth={1} className={cn('h-4 w-4 shrink-0', className)} />;
}
