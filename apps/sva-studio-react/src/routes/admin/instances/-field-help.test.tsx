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

  it('renders the optional default hint and opens above the trigger when there is no space below', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 240,
    });

    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function mockRect(this: HTMLElement) {
        if (this instanceof HTMLButtonElement) {
          return {
            x: 64,
            y: 210,
            width: 20,
            height: 20,
            top: 210,
            right: 84,
            bottom: 230,
            left: 64,
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

    const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
    const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140);

    render(
      <FieldHelp
        title="Auth-Issuer-URL"
        what="Was"
        value="Wert"
        source="Quelle"
        impact="Auswirkung"
        defaultHint="Standardwert bleibt leer."
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Auth-Issuer-URL' }));

    const tooltip = screen.getByRole('tooltip', { name: 'Auth-Issuer-URL' });
    expect(screen.getByText('Standardwert bleibt leer.')).toBeTruthy();
    expect(tooltip.getAttribute('style')).toContain('left: 64px;');
    expect(tooltip.getAttribute('style')).toContain('top: 62px;');

    offsetWidthSpy.mockRestore();
    offsetHeightSpy.mockRestore();
    getBoundingClientRectSpy.mockRestore();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('closes the help panel on outside click, escape, and repeated toggle', () => {
    render(
      <div>
        <button type="button">Außen</button>
        <FieldHelp
          title="Auth-Issuer-URL"
          what="Was"
          value="Wert"
          source="Quelle"
          impact="Auswirkung"
        />
      </div>
    );

    const trigger = screen.getByRole('button', { name: 'Auth-Issuer-URL' });

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip', { name: 'Auth-Issuer-URL' })).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Außen' }));
    expect(screen.queryByRole('tooltip', { name: 'Auth-Issuer-URL' })).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip', { name: 'Auth-Issuer-URL' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip', { name: 'Auth-Issuer-URL' })).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip', { name: 'Auth-Issuer-URL' })).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip', { name: 'Auth-Issuer-URL' })).toBeNull();
  });
});
