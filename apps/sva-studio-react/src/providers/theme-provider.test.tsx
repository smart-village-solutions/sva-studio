import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_MODE_STORAGE_KEY } from '../lib/theme';
import { ThemeProvider, useTheme } from './theme-provider';

const useAuthMock = vi.fn();
type LocalStorageMock = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

vi.mock('./auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

const ThemeProbe = () => {
  const theme = useTheme();

  return (
    <div>
      <p data-testid="theme-name">{theme.themeName}</p>
      <p data-testid="theme-mode">{theme.mode}</p>
      <p data-testid="theme-label">{theme.themeLabel}</p>
      <button type="button" onClick={theme.toggleMode}>
        toggle
      </button>
    </div>
  );
};

describe('ThemeProvider', () => {
  beforeEach(() => {
    const localStorageMock: LocalStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    useAuthMock.mockReset();
    vi.unstubAllGlobals();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
    document.documentElement.style.colorScheme = '';
  });

  it('resolves the theme variant from instanceId and applies dark mode preference', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Ada',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-name').textContent).toBe('sva-forest');
    });

    expect(screen.getByTestId('theme-mode').textContent).toBe('dark');
    expect(screen.getByTestId('theme-label').textContent).toBe('SVA Forest');
    expect(document.documentElement.dataset.theme).toBe('sva-forest');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses persisted theme mode and can toggle it', async () => {
    const localStorageMock = window.localStorage as unknown as LocalStorageMock;

    useAuthMock.mockReturnValue({
      user: {
        id: 'user-2',
        name: 'Ada',
        roles: ['editor'],
        instanceId: 'unknown-instance',
      },
    });
    localStorageMock.getItem.mockReturnValue('light');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-mode').textContent).toBe('light');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    await waitFor(() => {
      expect(screen.getByTestId('theme-mode').textContent).toBe('dark');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(THEME_MODE_STORAGE_KEY, 'dark');
    expect(document.documentElement.dataset.theme).toBe('sva-default');
  });
});
