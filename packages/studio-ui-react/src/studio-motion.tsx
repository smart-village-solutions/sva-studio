import * as React from 'react';

import { ContentAssemblyArtwork, WorkbenchArtwork } from './studio-motion-artwork.js';
import { cn } from './utils.js';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeToReducedMotion = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const readReducedMotion = (): boolean =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(REDUCED_MOTION_QUERY).matches;

const useReducedMotion = (): boolean =>
  React.useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => true);

export type StudioAnimatedLoadingStateProps = Readonly<{
  children: React.ReactNode;
  className?: string;
  entryDelayMs?: number;
}>;

export function StudioAnimatedLoadingState({
  children,
  className,
  entryDelayMs = 120,
}: StudioAnimatedLoadingStateProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const safeEntryDelayMs = Math.min(Math.max(entryDelayMs, 0), 150);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;

    let active = true;
    let dispose: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      void import('./studio-motion.anime.js').then(({ startContentAssemblyAnimation }) => {
        if (active) dispose = startContentAssemblyAnimation(root);
      });
    }, safeEntryDelayMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
      dispose?.();
    };
  }, [reducedMotion, safeEntryDelayMs]);

  return (
    <div
      ref={rootRef}
      aria-live="polite"
      className={cn(
        'flex min-h-44 flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card/45 px-6 py-8 text-center shadow-sm',
        className
      )}
      role="status"
    >
      <ContentAssemblyArtwork reducedMotion={reducedMotion} />
      <span className="text-sm font-medium text-muted-foreground">{children}</span>
    </div>
  );
}

export type StudioWorkbenchSceneProps = Readonly<{
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  mode: 'full' | 'compact';
  scene: 'anonymous' | 'authenticated';
  showArtwork?: boolean;
}>;

export function StudioWorkbenchScene({
  active = true,
  children,
  className,
  mode,
  scene,
  showArtwork = true,
}: StudioWorkbenchSceneProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    const root = rootRef.current;
    if (!active || !root || reducedMotion) return;

    let mounted = true;
    let dispose: (() => void) | undefined;
    void import('./studio-motion.anime.js').then(({ startWorkbenchAnimation }) => {
      if (mounted) dispose = startWorkbenchAnimation(root, { mode, scene });
    });

    return () => {
      mounted = false;
      dispose?.();
    };
  }, [active, mode, reducedMotion, scene]);

  return (
    <div
      ref={rootRef}
      className={cn('relative isolate', className)}
      data-motion-mode={reducedMotion ? 'reduced' : mode}
      data-motion-requested-mode={mode}
      data-motion-scene={scene}
    >
      {showArtwork ? <WorkbenchArtwork reducedMotion={reducedMotion} /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
