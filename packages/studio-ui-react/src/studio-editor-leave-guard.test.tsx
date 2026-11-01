/** Verifies the value-free editor/host connection and synchronous save acknowledgement. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from './dialog.js';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from './alert-dialog.js';

import {
  StudioEditorLeaveGuardProvider,
  useStudioEditorLeaveGuard,
} from './studio-editor-leave-guard.js';

afterEach(cleanup);

describe('studio editor leave guard', () => {
  it.each(['dialog', 'alertdialog'])(
    'suspends a portalled %s without losing its draft or trapping recovery focus',
    async (kind) => {
      const register = () => () => undefined;
      const Root = kind === 'dialog' ? Dialog : AlertDialog;
      const Content = kind === 'dialog' ? DialogContent : AlertDialogContent;
      const Title = kind === 'dialog' ? DialogTitle : AlertDialogTitle;
      const Description = kind === 'dialog' ? DialogDescription : AlertDialogDescription;
      const Draft = () => {
        const [value, setValue] = React.useState('Draft');
        return (
          <input
            aria-label="Dialog draft"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        );
      };
      const Harness = ({ suspended }: { suspended: boolean }) => (
        <>
          <button type="button">Recover</button>
          <StudioEditorLeaveGuardProvider register={register} suspended={suspended}>
            <Root open>
              <Content>
                <Title>Editor</Title>
                <Description>Draft editor</Description>
                <Draft />
              </Content>
            </Root>
          </StudioEditorLeaveGuardProvider>
        </>
      );
      const view = render(<Harness suspended={false} />);
      const input = await screen.findByLabelText('Dialog draft');
      fireEvent.change(input, { target: { value: 'Unsaved dialog metadata' } });
      view.rerender(<Harness suspended />);
      await waitFor(() => expect(screen.queryByRole(kind)).toBeNull());
      expect(document.body.style.pointerEvents).not.toBe('none');
      const recover = screen.getByRole('button', { name: 'Recover' });
      recover.focus();
      expect(document.activeElement).toBe(recover);
      view.rerender(<Harness suspended={false} />);
      expect(await screen.findByLabelText('Dialog draft')).toBe(input);
      expect((input as HTMLInputElement).value).toBe('Unsaved dialog metadata');
    }
  );

  it('reports live dirty state, acknowledges immediately and re-arms after a new edit', () => {
    let check: (() => boolean) | undefined;
    const cleanup = vi.fn();
    const register = vi.fn((next: () => boolean) => {
      check = next;
      return cleanup;
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StudioEditorLeaveGuardProvider register={register}>
        {children}
      </StudioEditorLeaveGuardProvider>
    );
    const { result, rerender, unmount } = renderHook(
      (props: { dirty: boolean; enabled: boolean }) =>
        useStudioEditorLeaveGuard({ enabled: props.enabled, hasUnsavedChanges: props.dirty }),
      { wrapper, initialProps: { dirty: false, enabled: true } }
    );
    expect(check?.()).toBe(false);
    rerender({ dirty: true, enabled: true });
    expect(check?.()).toBe(true);
    const revision = result.current.captureRevision();
    act(() => {
      expect(result.current.acknowledgeSaved(revision)).toBe(true);
    });
    expect(check?.()).toBe(false);
    // An unrelated render during the confirmed-save transition must not re-block it.
    rerender({ dirty: true, enabled: true });
    expect(check?.()).toBe(false);
    rerender({ dirty: false, enabled: true });
    rerender({ dirty: true, enabled: true });
    expect(check?.()).toBe(true);
    expect(register).toHaveBeenCalledTimes(1);
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not register edit views and cleans up when a create view becomes disabled', () => {
    const cleanup = vi.fn();
    const register = vi.fn(() => cleanup);
    const Editor = ({ enabled }: { enabled: boolean }) => {
      useStudioEditorLeaveGuard({ enabled, hasUnsavedChanges: true });
      return null;
    };
    const { rerender } = render(
      <StudioEditorLeaveGuardProvider register={register}>
        <Editor enabled={false} />
      </StudioEditorLeaveGuardProvider>
    );
    expect(register).not.toHaveBeenCalled();
    rerender(
      <StudioEditorLeaveGuardProvider register={register}>
        <Editor enabled />
      </StudioEditorLeaveGuardProvider>
    );
    expect(register).toHaveBeenCalledTimes(1);
    rerender(
      <StudioEditorLeaveGuardProvider register={register}>
        <Editor enabled={false} />
      </StudioEditorLeaveGuardProvider>
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps standalone editor rendering usable without a host provider', () => {
    const { result } = renderHook(() =>
      useStudioEditorLeaveGuard({ enabled: true, hasUnsavedChanges: true })
    );
    expect(() => result.current.acknowledgeSaved(result.current.captureRevision())).not.toThrow();
  });

  it('does not acknowledge edits made while a save or reference retry is pending', () => {
    let check = () => false;
    const register = (next: () => boolean) => {
      check = next;
      return () => undefined;
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StudioEditorLeaveGuardProvider register={register}>
        {children}
      </StudioEditorLeaveGuardProvider>
    );
    const { result } = renderHook(
      () => useStudioEditorLeaveGuard({ enabled: true, hasUnsavedChanges: true }),
      { wrapper }
    );
    const submittedRevision = result.current.captureRevision();
    act(() => result.current.markChanged());
    expect(result.current.acknowledgeSaved(submittedRevision)).toBe(false);
    expect(check()).toBe(true);
    const latestRevision = result.current.captureRevision();
    expect(result.current.acknowledgeSaved(latestRevision)).toBe(true);
    expect(check()).toBe(false);
  });

  it('does not dirty a clean form when RHF emits a named initialization event', () => {
    let check = () => false;
    const register = (next: () => boolean) => {
      check = next;
      return () => undefined;
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StudioEditorLeaveGuardProvider register={register}>
        {children}
      </StudioEditorLeaveGuardProvider>
    );
    const { result, rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) =>
        useStudioEditorLeaveGuard({ enabled: true, hasUnsavedChanges: dirty }),
      { wrapper, initialProps: { dirty: false } }
    );
    const revision = result.current.captureRevision();
    act(() => result.current.markChanged());
    expect(check()).toBe(false);
    // Revision tracking alone does not imply unsaved user input.
    expect(result.current.captureRevision()).toBe(revision + 1);
    rerender({ dirty: true });
    expect(check()).toBe(true);
  });
  it('protects newer input reverted to the original default while an older value is saved', () => {
    let check = () => false;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StudioEditorLeaveGuardProvider
        register={(next) => {
          check = next;
          return () => undefined;
        }}
      >
        {children}
      </StudioEditorLeaveGuardProvider>
    );
    const { result, rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) =>
        useStudioEditorLeaveGuard({ enabled: true, hasUnsavedChanges: dirty }),
      { wrapper, initialProps: { dirty: true } }
    );
    const submitted = result.current.captureRevision();
    act(() => result.current.markChanged());
    rerender({ dirty: false });
    expect(result.current.acknowledgeSaved(submitted)).toBe(false);
    expect(check()).toBe(true);
    rerender({ dirty: true });
    rerender({ dirty: false });
    expect(check()).toBe(true);
    expect(result.current.acknowledgeSaved(result.current.captureRevision())).toBe(true);
    expect(check()).toBe(false);
  });
});
