import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioMediaPickerLinkPanel } from './studio-media-picker-link-panel.js';

vi.mock('@sva/plugin-sdk/content-media', async (original) => ({
  ...(await original<object>()),
  useContentMediaTranslation: () => (key: string) => key,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = () => {
  const confirm = vi.fn();
  const cancel = vi.fn();
  const Harness = () => {
    const [value, setValue] = React.useState('');
    return (
      <StudioMediaPickerLinkPanel
        value={value}
        onChange={setValue}
        onConfirm={confirm}
        onCancel={cancel}
        disabled={false}
      />
    );
  };
  const { unmount } = render(<Harness />);
  return {
    unmount,
    confirm,
    cancel,
    input: screen.getByRole('textbox', { name: 'picker.url' }),
    submit: screen.getByRole('button', { name: 'picker.useMedia' }),
  };
};

describe('StudioMediaPickerLinkPanel', () => {
  it('adds only a confirmed valid URL and never adds a placeholder on cancel', () => {
    const { confirm, cancel, input, submit } = setup();
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    fireEvent.blur(input);
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: ' https://example.test/photo.jpg ' } });
    fireEvent.blur(input);
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.test/photo.jpg');
    fireEvent.click(submit);
    expect(confirm).toHaveBeenCalledExactlyOnceWith('https://example.test/photo.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'picker.cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('lets a valid link be used when its optional preview is unavailable', () => {
    const { input, submit, confirm } = setup();
    fireEvent.change(input, { target: { value: 'https://example.test/photo.jpg' } });
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('status').textContent).toBe('picker.previewUnavailable');
    expect(submit.hasAttribute('disabled')).toBe(false);
    fireEvent.click(submit);
    expect(confirm).toHaveBeenCalledExactlyOnceWith('https://example.test/photo.jpg');
  });

  it('preserves the confirmation click while an explicit HTTP URL is being probed for HTTPS', async () => {
    const probes: Array<{ onload: (() => void) | null; onerror: (() => void) | null }> = [];
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          probes.push(this);
        }
        set src(_value: string) {
          /* The HTTPS response remains pending during the click. */
        }
      }
    );
    const { input, submit, confirm, unmount } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'http://example.test/photo.jpg' } });
    expect(submit.hasAttribute('disabled')).toBe(false);
    fireEvent.pointerDown(submit);
    fireEvent.blur(input);
    expect(input.getAttribute('aria-busy')).toBe('true');
    expect(submit.hasAttribute('disabled')).toBe(false);
    fireEvent.pointerUp(submit);
    fireEvent.click(submit);
    expect(confirm).toHaveBeenCalledExactlyOnceWith('http://example.test/photo.jpg');
    unmount();
    await act(async () => {
      probes[0]?.onload?.();
    });
    expect(confirm).toHaveBeenCalledExactlyOnceWith('http://example.test/photo.jpg');
  });
});
