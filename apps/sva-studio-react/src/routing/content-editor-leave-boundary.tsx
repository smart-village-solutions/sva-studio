import { useBlocker } from '@tanstack/react-router';
import { StudioConfirmDialog, StudioEditorLeaveGuardProvider } from '@sva/studio-ui-react';
import React from 'react';

import { t } from '../i18n';

export function ContentEditorLeaveBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  const checker = React.useRef<(() => boolean) | null>(null);
  const register = React.useCallback((check: () => boolean) => {
    checker.current = check;
    return () => {
      if (checker.current === check) checker.current = null;
    };
  }, []);
  const hasUnsavedChanges = React.useCallback(() => checker.current?.() ?? false, []);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && hasUnsavedChanges(),
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

  return (
    <StudioEditorLeaveGuardProvider register={register}>
      {children}
      <StudioConfirmDialog
        open={blocker.status === 'blocked'}
        title={t('content.leaveGuard.title')}
        description={t('content.leaveGuard.description')}
        confirmLabel={t('content.leaveGuard.discard')}
        cancelLabel={t('content.leaveGuard.stay')}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </StudioEditorLeaveGuardProvider>
  );
}
