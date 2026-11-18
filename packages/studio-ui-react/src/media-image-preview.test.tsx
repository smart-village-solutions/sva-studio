import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StudioMediaImagePreview } from './media-image-preview.js';

const draw = vi.fn();
let dimensions = { width: 1200, height: 800 };
let imageFails = false;
class PreviewImage {
  naturalWidth = dimensions.width;
  naturalHeight = dimensions.height;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => (imageFails ? this.onerror?.() : this.onload?.()));
  }
}
beforeEach(() => {
  dimensions = { width: 1200, height: 800 };
  imageFails = false;
  draw.mockReset();
  vi.stubGlobal('Image', PreviewImage);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('renders actual square and wide crops and provides native keyboard focus controls', async () => {
  const change = vi.fn();
  const props = { url: 'blob:preview', focus: { x: 0.2, y: 0.8 }, onFocusChange: change };
  const view = render(<StudioMediaImagePreview {...props} />);
  await waitFor(() => expect(draw).toHaveBeenCalledTimes(3));
  expect(draw.mock.calls.map((call) => call.slice(1))).toEqual([
    [0, 0, 800, 800, 0, 0, 320, 320],
    [0, 125, 1200, 675, 0, 0, 800, 450],
    [0, 125, 1200, 675, 0, 0, 1600, 900],
  ]);
  expect(screen.getAllByRole('img')).toHaveLength(3);
  fireEvent.load(view.container.querySelector('img')!);
  const point = screen.getByRole('button', { name: 'media.editor.focusTitle' });
  fireEvent.keyDown(point, { key: 'ArrowRight' });
  expect(change).toHaveBeenLastCalledWith({ x: 0.21000000000000002, y: 0.8 });
  fireEvent.keyDown(point, { key: 'ArrowUp', shiftKey: true });
  expect(change).toHaveBeenLastCalledWith({ x: 0.2, y: 0.7000000000000001 });
  fireEvent.click(screen.getByRole('button', { name: 'media.editor.centerFocus' }));
  expect(change).toHaveBeenLastCalledWith({ x: 0.5, y: 0.5 });
  view.rerender(<StudioMediaImagePreview {...props} disabled />);
  expect(
    screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled)
  ).toBe(true);
  expect(screen.getAllByRole('img')).toHaveLength(3);
});

it('warns about enlargement without blocking editorial controls', async () => {
  dimensions = { width: 120, height: 80 };
  const view = render(
    <StudioMediaImagePreview url="blob:small" focus={{ x: 0.5, y: 0.5 }} onFocusChange={vi.fn()} />
  );
  await waitFor(() => expect(screen.getAllByText('media.editor.smallImageHint')).toHaveLength(3));
  fireEvent.load(view.container.querySelector('img')!);
  expect(
    (screen.getByRole('button', { name: 'media.editor.centerFocus' }) as HTMLButtonElement).disabled
  ).toBe(false);
});

it('keeps the workspace usable when a preview fails to load', async () => {
  imageFails = true;
  render(
    <StudioMediaImagePreview url="blob:failed" focus={{ x: 0.5, y: 0.5 }} onFocusChange={vi.fn()} />
  );
  await waitFor(() => expect(screen.getAllByText('media.editor.previewError')).toHaveLength(3));
  expect(draw).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'media.editor.focusTitle' })).toBeDefined();
});

it('ignores image completions after the preview is unmounted', async () => {
  const view = render(
    <StudioMediaImagePreview
      url="blob:cancelled"
      focus={{ x: 0.5, y: 0.5 }}
      onFocusChange={vi.fn()}
    />
  );
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(draw).not.toHaveBeenCalled();
});

it('maps pointer coordinates to the image and ignores its surrounding margins', () => {
  const change = vi.fn();
  const view = render(
    <StudioMediaImagePreview url="blob:point" focus={{ x: 0, y: 1 }} onFocusChange={change} />
  );
  const image = view.container.querySelector('img')!;
  fireEvent.load(image);
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    width: 400,
    height: 200,
  } as DOMRect);
  const point = screen.getByRole('button', { name: 'media.editor.focusTitle' });
  const pointer = (x: number, y: number) => {
    const event = new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    fireEvent(point, event);
  };
  pointer(200, 200);
  expect(change).toHaveBeenLastCalledWith({ x: 0.25, y: 0.75 });
  pointer(50, 150);
  pointer(200, 300);
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(point, { key: 'ArrowLeft' });
  expect(change).toHaveBeenLastCalledWith({ x: 0, y: 1 });
  fireEvent.keyDown(point, { key: 'ArrowDown' });
  expect(change).toHaveBeenLastCalledWith({ x: 0, y: 1 });
});
