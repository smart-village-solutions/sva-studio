import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateMock = vi.fn();
const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => undefined);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    invalidate: invalidateMock,
  }),
}));

afterEach(() => {
  cleanup();
  invalidateMock.mockReset();
  consoleErrorMock.mockClear();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

const importErrorFallback = async () => {
  const mod = await import('./ErrorFallback');
  return mod.default;
};

describe('ErrorFallback', () => {
  it('renders the localized fallback and retries via router invalidation', async () => {
    const resetMock = vi.fn();
    const ErrorFallback = await importErrorFallback();

    render(<ErrorFallback error={new Error('kaputt')} reset={resetMock} info={{ componentStack: '' }} />);

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(invalidateMock).toHaveBeenCalledTimes(1);
  });

  it('shows debug details only with explicit opt-in on local hosts', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_ERROR_DEBUG_DETAILS', 'true');
    const ErrorFallback = await importErrorFallback();

    render(
      <ErrorFallback error={new Error('debug details')} reset={vi.fn()} info={{ componentStack: '' }} />
    );

    expect(screen.getByText('Lokale Diagnose')).toBeTruthy();
    expect(screen.getByText('debug details')).toBeTruthy();
  });
});
