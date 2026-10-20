import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentSyncSupport } from './-content-sync-support';
import { IamHttpError } from '../../lib/iam-http-client';

const diagnostic = {
  instanceId: 'bb-prignitz',
  contentType: 'news.article',
  source: 'organization' as const,
  outcome: 'not_possible' as const,
  reasonCode: 'binding_not_verified',
  occurredAt: '2026-10-20T10:00:00Z',
  requestId: 'recovery-request',
  originalRequestId: 'original-request',
};
const error = new IamHttpError({
  status: 503,
  code: 'mainserver_credentials_missing',
  message: 'raw provider detail must not be shown',
  requestId: 'list-request',
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('content sync support', () => {
  it('explains the exact safe cause and offers a selectable diagnostic block without raw details', () => {
    render(<ContentSyncSupport diagnostics={[diagnostic]} metadata={null} error={error} />);
    expect(screen.getByText(/support@smart-village.solutions/)).toBeTruthy();
    const text = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(text.readOnly).toBe(true);
    expect(text.value).toContain('bb-prignitz');
    expect(text.value).toContain('binding_not_verified');
    expect(text.value).toContain('original-request');
    expect(text.value).toContain('recovery-request');
    expect(text.value).toContain('2026-10-20T10:00:00Z');
    expect(text.value).not.toContain(error.message);
    expect(
      screen.getByText(/keine eindeutige aktuelle verifizierte Organisationsbindung/)
    ).toBeTruthy();
  });

  it('copies only the projected support text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<ContentSyncSupport diagnostics={[diagnostic]} metadata={null} error={error} />);
    fireEvent.click(screen.getByRole('button', { name: /Diagnoseangaben kopieren/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toBe(
      (screen.getByRole('textbox') as HTMLTextAreaElement).value
    );
    expect(screen.getByRole('status').textContent).toMatch(/kopiert/);
  });

  it('retains selectable text when clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('unavailable')) },
    });
    render(<ContentSyncSupport diagnostics={[diagnostic]} metadata={null} error={error} />);
    fireEvent.click(screen.getByRole('button', { name: /Diagnoseangaben kopieren/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/manuell kopieren/));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('shows only a neutral accessible status while checking', () => {
    render(<ContentSyncSupport diagnostics={[diagnostic]} metadata={null} error={error} pending />);
    expect(screen.getByRole('status').textContent).toMatch(/automatisch/);
    expect(screen.queryByRole('textbox')).not.toBeTruthy();
  });

  it('does not display a support error after successful recovery and content refresh', () => {
    render(
      <ContentSyncSupport
        diagnostics={[{ ...diagnostic, outcome: 'restored', reasonCode: 'restored' }]}
        metadata={null}
        error={null}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeTruthy();
  });
});
