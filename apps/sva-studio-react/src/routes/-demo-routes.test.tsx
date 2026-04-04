import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useServerFnMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet" />,
  createRoute: vi.fn((options) => ({
    ...options,
    addChildren: (children: unknown[]) => ({ ...options, children }),
    useLoaderData: () => [],
  })),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator() {
      return this;
    },
    handler(fn: unknown) {
      return fn;
    },
  }),
  useServerFn: (serverFn: unknown) => useServerFnMock(serverFn),
}));

describe('demo routes', () => {
  beforeEach(() => {
    useServerFnMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('executes the server function demo after hydration and renders the response', async () => {
    const runServerFn = vi.fn().mockResolvedValue({
      message: 'Hallo Welt!',
      serverTime: '2026-04-04T18:00:00.000Z',
    });
    useServerFnMock.mockReturnValue(runServerFn);

    const { ServerFuncsDemo } = await import('./-demo-routes');

    render(<ServerFuncsDemo />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Server Function ausführen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Server Function ausführen' }));

    await waitFor(() => {
      expect(runServerFn).toHaveBeenCalledWith({ data: { name: '' } });
      expect(screen.getByText('Hallo Welt!')).toBeTruthy();
    });
  });

  it('loads names through the api request demo and renders the list', async () => {
    const loadNames = vi.fn().mockResolvedValue(['Aria', 'Lea']);
    useServerFnMock.mockReturnValue(loadNames);

    const { ApiRequestDemo } = await import('./-demo-routes');

    render(<ApiRequestDemo />);

    fireEvent.click(screen.getByRole('button', { name: 'Namen laden' }));

    await waitFor(() => {
      expect(loadNames).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Aria')).toBeTruthy();
      expect(screen.getByText('Lea')).toBeTruthy();
    });
  });
});
