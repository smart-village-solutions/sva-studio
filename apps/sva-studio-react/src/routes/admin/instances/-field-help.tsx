import * as React from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '../../../i18n';
import type { InstanceFieldHelpKey } from './-instances-shared-types';

export const INSTANCE_FIELD_HELP: Record<
  InstanceFieldHelpKey,
  {
    readonly title: string;
    readonly what: string;
    readonly value: string;
    readonly source: string;
    readonly impact: string;
    readonly defaultHint?: string;
  }
> = {
  realmMode: {
    title: t('admin.instances.help.realmMode.title'),
    what: t('admin.instances.help.realmMode.what'),
    value: t('admin.instances.help.realmMode.value'),
    source: t('admin.instances.help.realmMode.source'),
    impact: t('admin.instances.help.realmMode.impact'),
    defaultHint: t('admin.instances.help.realmMode.defaultHint'),
  },
  instanceId: {
    title: t('admin.instances.help.instanceId.title'),
    what: t('admin.instances.help.instanceId.what'),
    value: t('admin.instances.help.instanceId.value'),
    source: t('admin.instances.help.instanceId.source'),
    impact: t('admin.instances.help.instanceId.impact'),
  },
  displayName: {
    title: t('admin.instances.help.displayName.title'),
    what: t('admin.instances.help.displayName.what'),
    value: t('admin.instances.help.displayName.value'),
    source: t('admin.instances.help.displayName.source'),
    impact: t('admin.instances.help.displayName.impact'),
  },
  parentDomain: {
    title: t('admin.instances.help.parentDomain.title'),
    what: t('admin.instances.help.parentDomain.what'),
    value: t('admin.instances.help.parentDomain.value'),
    source: t('admin.instances.help.parentDomain.source'),
    impact: t('admin.instances.help.parentDomain.impact'),
    defaultHint: t('admin.instances.help.parentDomain.defaultHint'),
  },
  authRealm: {
    title: t('admin.instances.help.authRealm.title'),
    what: t('admin.instances.help.authRealm.what'),
    value: t('admin.instances.help.authRealm.value'),
    source: t('admin.instances.help.authRealm.source'),
    impact: t('admin.instances.help.authRealm.impact'),
  },
  authClientId: {
    title: t('admin.instances.help.authClientId.title'),
    what: t('admin.instances.help.authClientId.what'),
    value: t('admin.instances.help.authClientId.value'),
    source: t('admin.instances.help.authClientId.source'),
    impact: t('admin.instances.help.authClientId.impact'),
    defaultHint: t('admin.instances.help.authClientId.defaultHint'),
  },
  authIssuerUrl: {
    title: t('admin.instances.help.authIssuerUrl.title'),
    what: t('admin.instances.help.authIssuerUrl.what'),
    value: t('admin.instances.help.authIssuerUrl.value'),
    source: t('admin.instances.help.authIssuerUrl.source'),
    impact: t('admin.instances.help.authIssuerUrl.impact'),
    defaultHint: t('admin.instances.help.authIssuerUrl.defaultHint'),
  },
  authClientSecret: {
    title: t('admin.instances.help.authClientSecret.title'),
    what: t('admin.instances.help.authClientSecret.what'),
    value: t('admin.instances.help.authClientSecret.value'),
    source: t('admin.instances.help.authClientSecret.source'),
    impact: t('admin.instances.help.authClientSecret.impact'),
  },
  tenantAdminClientId: {
    title: t('admin.instances.help.tenantAdminClientId.title'),
    what: t('admin.instances.help.tenantAdminClientId.what'),
    value: t('admin.instances.help.tenantAdminClientId.value'),
    source: t('admin.instances.help.tenantAdminClientId.source'),
    impact: t('admin.instances.help.tenantAdminClientId.impact'),
    defaultHint: t('admin.instances.help.tenantAdminClientId.defaultHint'),
  },
  tenantAdminClientSecret: {
    title: t('admin.instances.help.tenantAdminClientSecret.title'),
    what: t('admin.instances.help.tenantAdminClientSecret.what'),
    value: t('admin.instances.help.tenantAdminClientSecret.value'),
    source: t('admin.instances.help.tenantAdminClientSecret.source'),
    impact: t('admin.instances.help.tenantAdminClientSecret.impact'),
  },
  tenantAdminUsername: {
    title: t('admin.instances.help.tenantAdminUsername.title'),
    what: t('admin.instances.help.tenantAdminUsername.what'),
    value: t('admin.instances.help.tenantAdminUsername.value'),
    source: t('admin.instances.help.tenantAdminUsername.source'),
    impact: t('admin.instances.help.tenantAdminUsername.impact'),
  },
  tenantAdminEmail: {
    title: t('admin.instances.help.tenantAdminEmail.title'),
    what: t('admin.instances.help.tenantAdminEmail.what'),
    value: t('admin.instances.help.tenantAdminEmail.value'),
    source: t('admin.instances.help.tenantAdminEmail.source'),
    impact: t('admin.instances.help.tenantAdminEmail.impact'),
  },
  tenantAdminFirstName: {
    title: t('admin.instances.help.tenantAdminFirstName.title'),
    what: t('admin.instances.help.tenantAdminFirstName.what'),
    value: t('admin.instances.help.tenantAdminFirstName.value'),
    source: t('admin.instances.help.tenantAdminFirstName.source'),
    impact: t('admin.instances.help.tenantAdminFirstName.impact'),
  },
  tenantAdminLastName: {
    title: t('admin.instances.help.tenantAdminLastName.title'),
    what: t('admin.instances.help.tenantAdminLastName.what'),
    value: t('admin.instances.help.tenantAdminLastName.value'),
    source: t('admin.instances.help.tenantAdminLastName.source'),
    impact: t('admin.instances.help.tenantAdminLastName.impact'),
  },
};

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
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

export const FieldHelp = ({ title, what, value, source, impact, defaultHint }: FieldHelpProps) => {
  const [open, setOpen] = React.useState(false);
  const [popoverPosition, setPopoverPosition] = React.useState<{
    left: number;
    top: number;
  } | null>(null);
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

    const maxLeft = Math.max(
      VIEWPORT_PADDING_PX,
      window.innerWidth - popoverWidth - VIEWPORT_PADDING_PX
    );
    const left = Math.min(Math.max(triggerRect.left, VIEWPORT_PADDING_PX), maxLeft);

    const maxTop = Math.max(
      VIEWPORT_PADDING_PX,
      window.innerHeight - popoverHeight - VIEWPORT_PADDING_PX
    );
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
      if (
        !containerRef.current?.contains(targetNode) &&
        !popoverRef.current?.contains(targetNode)
      ) {
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

  useIsomorphicLayoutEffect(() => {
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
              style={
                popoverPosition
                  ? { left: `${popoverPosition.left}px`, top: `${popoverPosition.top}px` }
                  : undefined
              }
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
