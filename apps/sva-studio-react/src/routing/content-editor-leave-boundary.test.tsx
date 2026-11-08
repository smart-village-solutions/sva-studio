// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';

import { ContentEditorLeaveBoundary } from './content-editor-leave-boundary';

type Register = (check: () => boolean) => () => void;
type BlockerOptions = {
  shouldBlockFn: (input: { current: { pathname: string }; next: { pathname: string } }) => boolean;
  enableBeforeUnload: () => boolean;
  withResolver: boolean;
};
const state = vi.hoisted(() => ({
  user: { id: 'user-1', instanceId: 'de-musterhausen', roles: [] as string[] } as {
    id: string;
    instanceId: string;
    roles: string[];
  } | null,
  organizationId: 'org-1',
  refreshSession: vi.fn(async () => undefined),
  refetchOrganization: vi.fn(async () => undefined),
  fetchAuth: vi.fn(),
  getContext: vi.fn(),
  options: null as BlockerOptions | null,
  register: null as Register | null,
  blocked: false,
  proceed: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({ user: state.user, refreshSession: state.refreshSession }),
}));
vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => ({
    context: { activeOrganizationId: state.organizationId },
    error: null,
    refetch: state.refetchOrganization,
  }),
}));
vi.mock('../lib/iam-api', () => ({
  fetchWithRequestTimeout: state.fetchAuth,
  getMyOrganizationContext: state.getContext,
}));
vi.mock('../providers/effective-access-invalidation', () => ({
  requestEffectiveAccessInvalidation: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useBlocker: (options: BlockerOptions) => {
    state.options = options;
    return state.blocked
      ? { status: 'blocked', proceed: state.proceed, reset: state.reset }
      : { status: 'idle', proceed: undefined, reset: undefined };
  },
}));
vi.mock('@sva/studio-ui-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/studio-ui-react')>();
  return {
    ...actual,
    StudioEditorLeaveGuardProvider: (
      props: React.ComponentProps<typeof actual.StudioEditorLeaveGuardProvider>
    ) => {
      state.register = props.register;
      return <actual.StudioEditorLeaveGuardProvider {...props} />;
    },
  };
});
vi.mock('../i18n', () => ({ t: (key: string) => key }));

function Editor({
  dirty = false,
  enabled = true,
}: Readonly<{ dirty?: boolean; enabled?: boolean }>) {
  const guard = useStudioEditorLeaveGuard({ enabled, hasUnsavedChanges: dirty });
  return (
    <button type="button" onClick={() => guard.acknowledgeSaved(guard.captureRevision())}>
      Save confirmed
    </button>
  );
}
const options = () => {
  if (!state.options) throw new Error('Blocker is not mounted');
  return state.options;
};
const leaving = () =>
  options().shouldBlockFn({
    current: { pathname: '/admin/news/new' },
    next: { pathname: '/admin/content' },
  });

describe('ContentEditorLeaveBoundary', () => {
  beforeEach(() => {
    state.user = { id: 'user-1', instanceId: 'de-musterhausen', roles: [] };
    state.organizationId = 'org-1';
    state.refetchOrganization.mockReset().mockResolvedValue(undefined);
    state.fetchAuth.mockResolvedValue(Response.json({ user: state.user }));
    state.getContext.mockResolvedValue({ data: { activeOrganizationId: 'org-1' } });
    state.options = null;
    state.register = null;
    state.blocked = false;
    state.proceed.mockReset();
    state.reset.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('retains a mounted draft during auth navigation and resumes only after explicit verification', async () => {
    const view = render(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    const editor = screen.getByRole('button', { name: 'Save confirmed' });
    const event = new Event('studio:auth-recovery-navigation', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(editor.closest('fieldset')?.hidden).toBe(true);
    const login = screen.getByRole('link', { name: 'content.leaveGuard.signInNewTab' });
    expect(login.getAttribute('target')).toBe('_blank');
    expect(state.fetchAuth).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'content.leaveGuard.resumeEditor' }));
    await waitFor(() => expect(editor.closest('fieldset')?.hidden).toBe(false));
    expect(screen.getByRole('button', { name: 'Save confirmed' })).toBe(editor);
    expect(leaving()).toBe(true);
    view.unmount();
  });
  it.each(['account', 'organization'])('keeps the draft locked for a changed %s', async (kind) => {
    render(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    if (kind === 'account')
      state.fetchAuth.mockResolvedValueOnce(
        Response.json({ user: { id: 'other', instanceId: 'de-musterhausen' } })
      );
    else state.getContext.mockResolvedValueOnce({ data: { activeOrganizationId: 'other-org' } });
    act(() => {
      window.dispatchEvent(new Event('studio:auth-recovery-navigation', { cancelable: true }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'content.leaveGuard.resumeEditor' }));
    await screen.findByText('content.leaveGuard.sessionRecoveryFailed');
    expect(screen.queryByRole('button', { name: 'Save confirmed' })).toBeNull();
    expect(state.refreshSession).not.toHaveBeenCalled();
  });
  it('checks the final published organization after the recovery refetch', async () => {
    state.refetchOrganization.mockImplementationOnce(async () => {
      state.organizationId = 'changed-during-refetch';
    });
    render(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    act(() => {
      window.dispatchEvent(new Event('studio:auth-recovery-navigation', { cancelable: true }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'content.leaveGuard.resumeEditor' }));
    await screen.findByText('content.leaveGuard.sessionRecoveryFailed');
    expect(screen.queryByRole('button', { name: 'Save confirmed' })).toBeNull();
  });

  it('keeps a nested media or targeting draft protected when the main form is clean', () => {
    const view = render(
      <ContentEditorLeaveBoundary>
        <Editor />
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(true);
    const event = new Event('studio:auth-recovery-navigation', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    view.unmount();
  });

  it('allows normal auth navigation without an unsaved editor', () => {
    render(
      <ContentEditorLeaveBoundary>
        <Editor />
      </ContentEditorLeaveBoundary>
    );
    const event = new Event('studio:auth-recovery-navigation', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it('allows navigation without an editor registration and does not show a dialog', () => {
    render(
      <ContentEditorLeaveBoundary>
        <p>Loading editor</p>
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(false);
    expect(options().enableBeforeUnload()).toBe(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(options().withResolver).toBe(true);
  });

  it('reads the current editor state for route changes and native unload but allows section navigation', () => {
    const view = render(
      <ContentEditorLeaveBoundary>
        <Editor />
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(false);
    view.rerender(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(true);
    expect(options().enableBeforeUnload()).toBe(true);
    expect(
      options().shouldBlockFn({
        current: { pathname: '/admin/news/new' },
        next: { pathname: '/admin/news/new' },
      })
    ).toBe(false);
    view.rerender(
      <ContentEditorLeaveBoundary>
        <Editor dirty enabled={false} />
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(false);
    expect(options().enableBeforeUnload()).toBe(false);
  });

  it('keeps the dirty checker after cancelling and proceeds only after explicit discard', () => {
    const view = render(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    state.blocked = true;
    view.rerender(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'content.leaveGuard.stay' }));
    expect(state.reset).toHaveBeenCalled();
    expect(state.proceed).not.toHaveBeenCalled();
    expect(leaving()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'content.leaveGuard.discard' }));
    expect(state.proceed).toHaveBeenCalledTimes(1);
  });

  it('clears the live checker synchronously after a confirmed save and on editor unmount', () => {
    const view = render(
      <ContentEditorLeaveBoundary>
        <Editor dirty />
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save confirmed' }));
    expect(leaving()).toBe(false);
    expect(options().enableBeforeUnload()).toBe(false);
    view.rerender(
      <ContentEditorLeaveBoundary>
        <p>Editor closed</p>
      </ContentEditorLeaveBoundary>
    );
    expect(leaving()).toBe(false);
  });

  it('does not let an older registration cleanup erase the current editor checker', () => {
    render(
      <ContentEditorLeaveBoundary>
        <p>Editor boundary</p>
      </ContentEditorLeaveBoundary>
    );
    const register = state.register;
    if (!register) throw new Error('Editor boundary is not mounted');
    const previous = register(() => false);
    const current = register(() => true);
    act(previous);
    expect(leaving()).toBe(true);
    act(current);
    expect(leaving()).toBe(false);
  });
});
