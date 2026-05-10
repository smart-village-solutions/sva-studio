import { Badge } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

export const ShiftCard = ({
  title,
  originalDate,
  actualDate,
  description,
  badges,
  actions,
}: {
  readonly title: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly description?: string;
  readonly badges: readonly string[];
  readonly actions?: ReactNode;
}) => (
  <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{originalDate}</Badge>
      <Badge>{actualDate}</Badge>
      {badges.map((badge) => (
        <Badge key={badge} variant="secondary">
          {badge}
        </Badge>
      ))}
    </div>
  </section>
);
