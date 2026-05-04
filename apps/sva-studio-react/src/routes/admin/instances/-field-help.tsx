import * as React from 'react';
import { createPortal } from 'react-dom';
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

const POPOVER_WIDTH_PX = 320;
const VIEWPORT_PADDING_PX = 12;
const TRIGGER_OFFSET_PX = 8;

export const FieldHelp = ({ title, what, value, source, impact, defaultHint }: FieldHelpProps) => {
  const [open, setOpen] = React.useState(false);
  const [popoverPosition, setPopoverPosition] = React.useState<{ left: number; top: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const popoverId = React.useId();

  const updatePopoverPosition = React.useCallback(() => {
    if (!buttonRef.current || !popoverRef.current) {
      return;
    }

    const triggerRect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = popoverRef.current.offsetWidth || POPOVER_WIDTH_PX;
    const popoverHeight = popoverRef.current.offsetHeight || 0;

    const maxLeft = Math.max(VIEWPORT_PADDING_PX, window.innerWidth - popoverWidth - VIEWPORT_PADDING_PX);
    const left = Math.min(Math.max(triggerRect.left, VIEWPORT_PADDING_PX), maxLeft);

    const maxTop = Math.max(VIEWPORT_PADDING_PX, window.innerHeight - popoverHeight - VIEWPORT_PADDING_PX);
    const preferredTop = triggerRect.bottom + TRIGGER_OFFSET_PX;
    const canOpenAbove = triggerRect.top - TRIGGER_OFFSET_PX - popoverHeight >= VIEWPORT_PADDING_PX;
    const top =
      preferredTop > maxTop && canOpenAbove
        ? triggerRect.top - popoverHeight - TRIGGER_OFFSET_PX
        : Math.min(Math.max(preferredTop, VIEWPORT_PADDING_PX), maxTop);

    setPopoverPosition({ left, top });
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node;
      if (!containerRef.current?.contains(targetNode) && !popoverRef.current?.contains(targetNode)) {
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

  React.useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null);
      return;
    }

    updatePopoverPosition();

    const handleViewportChange = () => {
      updatePopoverPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePopoverPosition]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          open ? 'bg-accent text-accent-foreground' : 'bg-background'
        )}
        aria-label={title}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="tooltip"
              aria-label={title}
              className="fixed z-[120] w-80 rounded-xl border border-border bg-card p-4 shadow-2xl"
              style={popoverPosition ? { left: `${popoverPosition.left}px`, top: `${popoverPosition.top}px` } : undefined}
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
