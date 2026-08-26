import { IconHelpCircle } from '@tabler/icons-react';
import { Button, StudioPageTitleAccessoryProvider } from '@sva/studio-ui-react';
import React from 'react';

import { t } from '../i18n';

const LazyContextualHelp = React.lazy(async () => {
  const module = await import('./ContextualHelp');
  return { default: module.ContextualHelp };
});

export const ContextualHelpBoundary = ({
  children,
  enabled = true,
  pageId,
}: Readonly<{ children: React.ReactNode; enabled?: boolean; pageId: string }>) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      globalThis.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, []);

  const trigger = enabled ? (
    <Button
      ref={triggerRef}
      type="button"
      variant="tertiary"
      size="icon"
      aria-label={t('shell.contextualHelp.open')}
      onClick={() => setOpen(true)}
    >
      <IconHelpCircle aria-hidden="true" className="size-5" />
    </Button>
  ) : null;

  return (
    <>
      <StudioPageTitleAccessoryProvider accessory={trigger}>
        {children}
      </StudioPageTitleAccessoryProvider>
      {enabled ? (
        <React.Suspense fallback={null}>
          <LazyContextualHelp open={open} onOpenChange={handleOpenChange} pageId={pageId} />
        </React.Suspense>
      ) : null}
    </>
  );
};
