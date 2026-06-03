import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountPrivacyPage } from './-account-privacy-page';

const getMyDataSubjectRightsMock = vi.fn();
const requestDataExportMock = vi.fn();
const createDataSubjectRequestMock = vi.fn();
const checkOptionalProcessingMock = vi.fn();
const requestPermissionChangeMock = vi.fn();

vi.mock('../../lib/iam-api', () => ({
  getMyDataSubjectRights: (...args: unknown[]) => getMyDataSubjectRightsMock(...args),
  requestDataExport: (...args: unknown[]) => requestDataExportMock(...args),
  createDataSubjectRequest: (...args: unknown[]) => createDataSubjectRequestMock(...args),
  checkOptionalProcessing: (...args: unknown[]) => checkOptionalProcessingMock(...args),
  requestPermissionChange: (...args: unknown[]) => requestPermissionChangeMock(...args),
  buildMyDataExportDownloadUrl: (jobId: string, format: string) =>
    `/iam/me/data-export/status?jobId=${jobId}&download=${format}`,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

describe('AccountPrivacyPage', () => {
  beforeEach(() => {
    getMyDataSubjectRightsMock.mockReset();
    requestDataExportMock.mockReset();
    createDataSubjectRequestMock.mockReset();
    checkOptionalProcessingMock.mockReset();
    requestPermissionChangeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders six action cards with title description and CTA', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: true,
        requests: [],
        exportJobs: [],
        legalHolds: [],
        activityItems: [],
      },
    });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Datenschutz & Transparenz' })).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Rechteänderung beantragen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Auskunft anfordern' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Datenexport anfordern' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Widerspruch einreichen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Löschanfrage anfordern' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Einschränkung der Verarbeitung anfordern' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Betroffenenanfragen' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Verarbeitung' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verarbeitungsstatus prüfen' })).toBeNull();

    const actionCardShells = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.closest('.rounded-lg'))
      .filter((card): card is HTMLElement => card instanceof HTMLElement);

    expect(actionCardShells).toHaveLength(6);
    for (const card of actionCardShells) {
      expect(card.className).toContain('h-full');
      expect(card.className).toContain('min-h-[12.5rem]');
      expect(card.querySelector('svg')).toBeTruthy();
    }
  });

  it('renders a privacy activity table sorted by newest activity first', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: true,
        requests: [],
        exportJobs: [],
        legalHolds: [],
        activityItems: [
          {
            id: 'req-1',
            source: 'dsr',
            type: 'request',
            canonicalStatus: 'queued',
            rawStatus: 'accepted',
            title: 'Auskunft',
            summary: 'Anfrage wird vorbereitet',
            createdAt: '2026-03-17T09:00:00.000Z',
            metadata: {},
          },
          {
            id: 'req-2',
            source: 'dsr',
            type: 'request',
            canonicalStatus: 'completed',
            rawStatus: 'completed',
            title: 'Rechteänderung',
            summary: 'Mehr Rechte für Freigaben',
            createdAt: '2026-03-18T10:00:00.000Z',
            completedAt: '2026-03-18T10:05:00.000Z',
            metadata: {},
          },
          {
            id: 'exp-1',
            source: 'dsr',
            type: 'export_job',
            canonicalStatus: 'completed',
            rawStatus: 'sent',
            title: 'Datenexport',
            summary: 'CSV-Export bereit',
            format: 'csv',
            createdAt: '2026-03-16T08:00:00.000Z',
            completedAt: '2026-03-16T08:04:00.000Z',
            metadata: {},
          },
        ],
      },
    });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Datenschutzvorgänge' })).toBeTruthy();
    });

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent?.trim());
    expect(headers).toEqual(['Typ', 'Erstellungsdatum', 'Status', 'Letzte Änderung', 'ID', 'Aktionen']);

    const rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('req-2');
    expect(rows[1]?.textContent).not.toContain('Rechteänderung');
  });

  it('routes access requests through the same note dialog flow as the other request actions', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: true,
        requests: [],
        exportJobs: [],
        legalHolds: [],
        activityItems: [],
      },
    });
    createDataSubjectRequestMock.mockResolvedValue({ data: { id: 'req-1' } });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Auskunft anfordern' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auskunft anfordern' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Auskunft anfordern' })).toBeTruthy();
    });

    const accessDialog = screen.getByRole('dialog', { name: 'Auskunft anfordern' });
    expect(accessDialog.querySelector('form')?.className).toContain('pt-2');

    fireEvent.change(screen.getByLabelText('Zusätzliche Hinweise'), {
      target: { value: 'Bitte alle zu meinem Konto verarbeiteten Daten aufführen.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auskunft senden' }));

    await waitFor(() => {
      expect(createDataSubjectRequestMock).toHaveBeenCalledWith({
        type: 'access',
        payload: { reason: 'Bitte alle zu meinem Konto verarbeiteten Daten aufführen.' },
      });
    });
  });
});
