// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  options: null as BlockerOptions | null,
  register: null as Register | null,
  blocked: false,
  proceed: vi.fn(),
  reset: vi.fn(),
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
    state.options = null;
    state.register = null;
    state.blocked = false;
    state.proceed.mockReset();
    state.reset.mockReset();
  });
  afterEach(cleanup);

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
