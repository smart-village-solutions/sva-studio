import {
  ChartColumn,
  FileText,
  History,
  Images,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import { cn } from './utils.js';

export type StudioDetailTabIconName =
  'basis' | 'content' | 'settings' | 'moderation' | 'results' | 'history';

const studioDetailTabIcons = {
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
