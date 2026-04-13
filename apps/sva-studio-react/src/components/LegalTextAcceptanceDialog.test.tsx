import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LEGAL_ACCEPTANCE_REQUIRED_EVENT } from '../lib/iam-api';
import { AuthProvider } from '../providers/auth-provider';
import { LegalTextAcceptanceDialog } from './LegalTextAcceptanceDialog';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const getMyPendingLegalTextsMock = vi.fn();
const acceptLegalTextMock = vi.fn();
const asIamErrorMock = vi.fn();

vi.mock('../lib/iam-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/iam-api')>('../lib/iam-api');
  return {
    ...actual,
    getMyPendingLegalTexts: (...args: unknown[]) => getMyPendingLegalTextsMock(...args),
    acceptLegalText: (...args: unknown[]) => acceptLegalTextMock(...args),
    asIamError: (...args: unknown[]) => asIamErrorMock(...args),
  };
});

vi.mock('@sva/sdk/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

describe('LegalTextAcceptanceDialog', () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getMyPendingLegalTextsMock.mockReset();
    acceptLegalTextMock.mockReset();
    asIamErrorMock.mockReset();
    assignMock = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            name: 'Ada',
            roles: ['editor'],
            instanceId: 'de-musterhausen',
          },
        }),
      } satisfies Partial<Response>)
    );
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: assignMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows pending legal texts and accepts them all', async () => {
    getMyPendingLegalTextsMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'version-1',
            legalTextId: 'text-1',
            name: 'Nutzungsbedingungen',
            legalTextVersion: '1',
            locale: 'de-DE',
            contentHtml: '<p>Bitte akzeptieren</p>',
            publishedAt: '2026-03-22T19:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      });
    acceptLegalTextMock.mockResolvedValue({
      data: {
        workflowId: 'workflow-1',
        operation: 'accept_legal_text',
        status: 'ok',
      },
    });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    expect(await screen.findByRole('alertdialog', { name: 'Bitte Rechtstexte akzeptieren' })).toBeTruthy();
    expect(screen.getByText('Nutzungsbedingungen')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Alle akzeptieren' }));

    await waitFor(() => {
      expect(acceptLegalTextMock).toHaveBeenCalledWith({
        instanceId: 'de-musterhausen',
        legalTextId: 'text-1',
        legalTextVersion: '1',
        locale: 'de-DE',
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'Bitte Rechtstexte akzeptieren' })).toBeNull();
    });
    expect(assignMock).toHaveBeenCalledWith('/');
  });

  it('sanitizes rendered legal text html before injecting it into the dialog', async () => {
    getMyPendingLegalTextsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'version-1',
          legalTextId: 'text-1',
          name: 'Nutzungsbedingungen',
          legalTextVersion: '1',
          locale: 'de-DE',
          contentHtml:
            '<p>Sicher</p><script>alert(1)</script><a href="https://example.com" target="_blank">Extern</a>',
          publishedAt: '2026-03-22T19:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    expect(await screen.findByText('Nutzungsbedingungen')).toBeTruthy();
    expect(screen.getByText('Sicher')).toBeTruthy();

    const externalLink = screen.getByRole('link', { name: 'Extern' });
    expect(externalLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(document.body.innerHTML).not.toContain('<script');
  });

  it('suppresses the prompt on the legal text admin page', async () => {
    getMyPendingLegalTextsMock.mockResolvedValue({
      data: [
        {
          id: 'version-1',
          legalTextId: 'text-1',
          name: 'Nutzungsbedingungen',
          legalTextVersion: '1',
          locale: 'de-DE',
          contentHtml: '<p>Bitte akzeptieren</p>',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/admin/legal-texts" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).not.toHaveBeenCalled();
    });
    expect(screen.queryByRole('alertdialog', { name: 'Bitte Rechtstexte akzeptieren' })).toBeNull();
  });

  it('reloads pending texts when a legal acceptance error event is emitted', async () => {
    getMyPendingLegalTextsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'version-2',
            legalTextId: 'text-2',
            name: 'Datenschutzhinweise',
            legalTextVersion: '2',
            locale: 'de-DE',
            contentHtml: '<p>Neu</p>',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new CustomEvent(LEGAL_ACCEPTANCE_REQUIRED_EVENT));

    expect(await screen.findByText('Datenschutzhinweise')).toBeTruthy();
  });

  it('uses the sanitized return target from the legal acceptance event after accepting', async () => {
    getMyPendingLegalTextsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'version-2',
            legalTextId: 'text-2',
            name: 'Datenschutzhinweise',
            legalTextVersion: '2',
            locale: 'de-DE',
            contentHtml: '<p>Neu</p>',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      });
    acceptLegalTextMock.mockResolvedValue({
      data: {
        workflowId: 'workflow-2',
        operation: 'accept_legal_text',
        status: 'ok',
      },
    });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(
      new CustomEvent(LEGAL_ACCEPTANCE_REQUIRED_EVENT, {
        detail: { return_to: 'https://evil.example' },
      })
    );

    expect(await screen.findByText('Datenschutzhinweise')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alle akzeptieren' }));

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/');
    });
  });

  it('falls back to the current ui pathname when the event return target points to an api route', async () => {
    getMyPendingLegalTextsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'version-2',
            legalTextId: 'text-2',
            name: 'Datenschutzhinweise',
            legalTextVersion: '2',
            locale: 'de-DE',
            contentHtml: '<p>Neu</p>',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      });
    acceptLegalTextMock.mockResolvedValue({
      data: {
        workflowId: 'workflow-3',
        operation: 'accept_legal_text',
        status: 'ok',
      },
    });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/admin/users" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(
      new CustomEvent(LEGAL_ACCEPTANCE_REQUIRED_EVENT, {
        detail: { return_to: '/api/v1/iam/users' },
      })
    );

    expect(await screen.findByText('Datenschutzhinweise')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alle akzeptieren' }));

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/admin/users');
    });
  });

  it('reloads pending texts on window focus', async () => {
    getMyPendingLegalTextsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'version-3',
            legalTextId: 'text-3',
            name: 'Datenschutz',
            legalTextVersion: '3',
            locale: 'de-DE',
            contentHtml: '<p>Aktualisiert</p>',
            publishedAt: 'invalid-date',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new FocusEvent('focus'));

    expect(await screen.findByText('Datenschutz')).toBeTruthy();
    expect(screen.getByText(/invalid-date/)).toBeTruthy();
  });

  it('ignores focus events from descendant elements', async () => {
    getMyPendingLegalTextsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 1, total: 0 },
    });

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(new FocusEvent('focus', { bubbles: false }));

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });
  });

  it('suppresses unauthorized load errors', async () => {
    asIamErrorMock.mockReturnValueOnce({ code: 'unauthorized' });
    getMyPendingLegalTextsMock.mockRejectedValueOnce(new Error('unauthorized'));

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'Bitte Rechtstexte akzeptieren' })).toBeNull();
    });
  });

  it('shows generic load failures in the dialog', async () => {
    asIamErrorMock.mockReturnValueOnce({ code: 'database_unavailable' });
    getMyPendingLegalTextsMock.mockRejectedValueOnce(new Error('db down'));

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/account" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'Bitte Rechtstexte akzeptieren' })).toBeNull();
    });
  });

  it('deduplicates focus reloads while a pending legal text request is still running', async () => {
    let resolvePendingTexts: undefined | ((value: {
      data: [];
      pagination: { page: number; pageSize: number; total: number };
    }) => void);
    getMyPendingLegalTextsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePendingTexts = resolve;
        })
    );

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new FocusEvent('focus'));
    window.dispatchEvent(new FocusEvent('focus'));

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(1);
    });

    resolvePendingTexts?.({
      data: [],
      pagination: { page: 1, pageSize: 1, total: 0 },
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'Bitte Rechtstexte akzeptieren' })).toBeNull();
    });
  });

  it('shows acceptance errors and allows retry/logout actions', async () => {
    getMyPendingLegalTextsMock.mockResolvedValue({
      data: [
        {
          id: 'version-1',
          legalTextId: 'text-1',
          name: 'Nutzungsbedingungen',
          legalTextVersion: '1',
          locale: 'de-DE',
          contentHtml: '<p>Bitte akzeptieren</p>',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });
    acceptLegalTextMock.mockRejectedValue(new Error('failed'));

    render(
      <AuthProvider>
        <LegalTextAcceptanceDialog pathname="/" />
      </AuthProvider>
    );

    expect(await screen.findByText('Nutzungsbedingungen')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Alle akzeptieren' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Die Rechtstexte konnten nicht bestätigt werden.');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    await waitFor(() => {
      expect(getMyPendingLegalTextsMock).toHaveBeenCalledTimes(2);
      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledWith('/auth/logout', expect.any(Object));
    });
  });

});
