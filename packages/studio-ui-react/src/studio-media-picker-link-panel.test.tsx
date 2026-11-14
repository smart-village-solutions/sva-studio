import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioMediaPickerLinkPanel } from './studio-media-picker-link-panel.js';

vi.mock('@sva/plugin-sdk/content-media', async (original) => ({
  ...(await original<object>()),
  useContentMediaTranslation: () => (key: string) => key,
}));

afterEach(cleanup);

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
  render(<Harness />);
  return {
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
});
