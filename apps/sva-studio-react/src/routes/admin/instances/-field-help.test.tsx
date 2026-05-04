import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FieldHelp } from './-field-help';

describe('FieldHelp', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the help panel in a fixed top-layer overlay aligned to the trigger', () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });

    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function mockRect(this: HTMLElement) {
        if (this instanceof HTMLButtonElement) {
          return {
            x: 24,
            y: 140,
            width: 20,
            height: 20,
            top: 140,
            right: 44,
            bottom: 160,
            left: 24,
            toJSON: () => '',
          } as DOMRect;
        }

        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => '',
        } as DOMRect;
      });

    render(
      <FieldHelp
        title="Auth-Issuer-URL"
        what="Was"
        value="Wert"
        source="Quelle"
        impact="Auswirkung"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Auth-Issuer-URL' }));

    const tooltip = screen.getByRole('tooltip', { name: 'Auth-Issuer-URL' });
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip.className).toContain('fixed');
    expect(tooltip.className).toContain('z-[120]');
    expect(tooltip.getAttribute('style')).toContain('left: 24px;');
    expect(tooltip.getAttribute('style')).toContain('top: 168px;');

    getBoundingClientRectSpy.mockRestore();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });
});
