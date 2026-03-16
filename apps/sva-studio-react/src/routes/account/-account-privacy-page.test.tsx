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
});
