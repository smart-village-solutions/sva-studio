import * as React from 'react';
import { CircleHelp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '../../../i18n';

type FieldHelpProps = {
  readonly title: string;
  readonly what: string;
  readonly value: string;
  readonly source: string;
  readonly impact: string;
  readonly defaultHint?: string;
};

export const FieldHelp = ({ title, what, value, source, impact, defaultHint }: FieldHelpProps) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const popoverId = React.useId();

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          open ? 'bg-accent text-accent-foreground' : 'bg-background'
        )}
        aria-label={title}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          id={popoverId}
          role="tooltip"
          aria-label={title}
          className="absolute right-0 top-7 z-20 w-80 rounded-xl border border-border bg-card p-4 shadow-2xl"
        >
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium text-foreground">{title}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('admin.instances.help.sections.what')}
              </div>
              <p className="mt-1 text-muted-foreground">{what}</p>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('admin.instances.help.sections.value')}
              </div>
              <p className="mt-1 text-muted-foreground">{value}</p>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('admin.instances.help.sections.source')}
              </div>
              <p className="mt-1 text-muted-foreground">{source}</p>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('admin.instances.help.sections.impact')}
              </div>
              <p className="mt-1 text-muted-foreground">{impact}</p>
            </div>
            {defaultHint ? (
              <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground">
                {defaultHint}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
