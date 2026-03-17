import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountPrivacyPage } from './-account-privacy-page';

const getMyDataSubjectRightsMock = vi.fn();
const requestDataExportMock = vi.fn();
const createDataSubjectRequestMock = vi.fn();
const checkOptionalProcessingMock = vi.fn();

vi.mock('../../lib/iam-api', () => ({
  getMyDataSubjectRights: (...args: unknown[]) => getMyDataSubjectRightsMock(...args),
  requestDataExport: (...args: unknown[]) => requestDataExportMock(...args),
  createDataSubjectRequest: (...args: unknown[]) => createDataSubjectRequestMock(...args),
  checkOptionalProcessing: (...args: unknown[]) => checkOptionalProcessingMock(...args),
}));

describe('AccountPrivacyPage', () => {
  beforeEach(() => {
    getMyDataSubjectRightsMock.mockReset();
    requestDataExportMock.mockReset();
    createDataSubjectRequestMock.mockReset();
    checkOptionalProcessingMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders self-service overview with canonical DSR status labels', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: false,
        processingRestrictedAt: '2026-03-15T10:00:00.000Z',
        processingRestrictionReason: 'legal_hold',
        nonEssentialProcessingOptOutAt: '2026-03-14T10:00:00.000Z',
        requests: [
          {
            id: 'req-1',
            type: 'request',
            canonicalStatus: 'in_progress',
            rawStatus: 'processing',
            title: 'Auskunftsersuchen',
            summary: 'Auskunft zu Profil- und Organisationsdaten',
            createdAt: '2026-03-15T10:00:00.000Z',
            metadata: {},
          },
        ],
        exportJobs: [],
        legalHolds: [],
      },
    });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Datenschutz & Transparenz' })).toBeTruthy();
      expect(screen.getByText('Auskunftsersuchen')).toBeTruthy();
      expect(screen.getByText('In Bearbeitung')).toBeTruthy();
      expect(screen.getByText('Rohstatus: processing')).toBeTruthy();
      expect(screen.getByText('Eingeschränkt')).toBeTruthy();
    });
  });

  it('shows empty state and submits the CTA request', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: true,
        requests: [],
        exportJobs: [],
        legalHolds: [],
      },
    });
    createDataSubjectRequestMock.mockResolvedValue({ status: 'accepted' });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine Datenschutzvorgänge vorhanden')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Erste Auskunftsanfrage starten' }));

    await waitFor(() => {
      expect(createDataSubjectRequestMock).toHaveBeenCalledWith({ type: 'access' });
      expect(screen.getByText('Die Auskunftsanfrage wurde eingereicht.')).toBeTruthy();
    });
  });

  it('shows a blocked status message for optional processing checks', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: false,
        requests: [],
        exportJobs: [],
        legalHolds: [],
      },
    });
    checkOptionalProcessingMock.mockResolvedValue({
      error: 'blocked',
      blockedByRestriction: true,
    });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Verarbeitungsstatus prüfen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verarbeitungsstatus prüfen' }));

    await waitFor(() => {
      expect(screen.getByText('Die angefragte Verarbeitung ist derzeit blockiert.')).toBeTruthy();
    });
  });

  it('renders load failures as destructive alerts', async () => {
    getMyDataSubjectRightsMock.mockRejectedValue(new Error('privacy_unavailable'));

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('privacy_unavailable');
    });
  });

  it('renders export failures as destructive alerts', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: true,
        requests: [],
        exportJobs: [],
        legalHolds: [],
      },
    });
    requestDataExportMock.mockRejectedValue(new Error('forbidden_scope'));

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Datenexport anfordern' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Datenexport anfordern' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('forbidden_scope');
    });
  });

  it('renders export, request and legal-hold details and supports all privacy actions', async () => {
    getMyDataSubjectRightsMock.mockResolvedValue({
      data: {
        instanceId: 'de-musterhausen',
        accountId: 'account-1',
        nonEssentialProcessingAllowed: true,
        processingRestrictedAt: undefined,
        processingRestrictionReason: undefined,
        nonEssentialProcessingOptOutAt: undefined,
        requests: [
          {
            id: 'req-1',
            type: 'request',
            canonicalStatus: 'failed',
            rawStatus: 'rejected',
            title: 'Widerspruch',
            summary: 'Marketing-Opt-out',
            createdAt: '2026-03-15T10:00:00.000Z',
            metadata: {},
          },
        ],
        exportJobs: [
          {
            id: 'export-1',
            type: 'export_job',
            canonicalStatus: 'completed',
            rawStatus: 'done',
            title: 'Datenexport',
            summary: 'JSON-Export fertig',
            createdAt: '2026-03-14T10:00:00.000Z',
            completedAt: '2026-03-14T11:00:00.000Z',
            format: 'json',
            metadata: {},
          },
        ],
        legalHolds: [
          {
            id: 'hold-1',
            type: 'legal_hold',
            canonicalStatus: 'blocked',
            rawStatus: 'legal_hold',
            title: 'Rechtliche Sperre',
            summary: 'Löschung ausgesetzt',
            createdAt: '2026-03-13T10:00:00.000Z',
            blockedReason: 'legal_hold',
            metadata: {},
          },
        ],
      },
    });
    requestDataExportMock.mockResolvedValue({ status: 'accepted' });
    createDataSubjectRequestMock.mockResolvedValue({ status: 'accepted' });
    checkOptionalProcessingMock.mockResolvedValue({ allowed: true });

    render(<AccountPrivacyPage />);

    await waitFor(() => {
      expect(screen.getByText('Export-Jobs')).toBeTruthy();
      expect(screen.getByText('Rechtliche Sperren')).toBeTruthy();
      expect(screen.getByText('Abgeschlossen')).toBeTruthy();
      expect(screen.getByText('Fehlgeschlagen')).toBeTruthy();
      expect(screen.getByText('Blockiert')).toBeTruthy();
      expect(screen.getByText(/Format: json/)).toBeTruthy();
      expect(screen.getByText(/Blockiert durch: legal_hold/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Datenexport anfordern' }));

    await waitFor(() => {
      expect(requestDataExportMock).toHaveBeenCalledWith({ format: 'json', async: true });
      expect(screen.getByText('Der Export wurde in die Warteschlange gestellt.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auskunft anfordern' }));

    await waitFor(() => {
      expect(createDataSubjectRequestMock).toHaveBeenCalledWith({ type: 'access' });
      expect(screen.getByText('Die Auskunftsanfrage wurde eingereicht.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Widerspruch einreichen' }));

    await waitFor(() => {
      expect(createDataSubjectRequestMock).toHaveBeenCalledWith({ type: 'objection' });
      expect(screen.getByText('Der Widerspruch wurde eingereicht.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verarbeitungsstatus prüfen' }));

    await waitFor(() => {
      expect(checkOptionalProcessingMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Die optionale Verarbeitung ist aktuell zulässig.')).toBeTruthy();
    });
  });
});
