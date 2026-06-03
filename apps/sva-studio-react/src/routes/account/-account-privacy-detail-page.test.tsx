import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountPrivacyDetailPage } from './-account-privacy-detail-page';

const getMyDataSubjectRightsCaseMock = vi.fn();
const useNavigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => useNavigateMock,
}));

vi.mock('../../lib/iam-api', () => ({
  buildMyDataExportDownloadUrl: (jobId: string, format: string) =>
    `/iam/me/data-export/status?jobId=${jobId}&download=${format}`,
  getMyDataSubjectRightsCase: (...args: unknown[]) => getMyDataSubjectRightsCaseMock(...args),
}));

describe('AccountPrivacyDetailPage', () => {
  beforeEach(() => {
    getMyDataSubjectRightsCaseMock.mockReset();
    useNavigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the self-service privacy case detail and offers a back link', async () => {
    getMyDataSubjectRightsCaseMock.mockResolvedValue({
      data: {
        id: 'case-1',
        type: 'request',
        canonicalStatus: 'in_progress',
        rawStatus: 'processing',
        title: 'Rechteänderung',
        summary: 'Mehr Rechte für Veranstaltungsfreigaben',
        createdAt: '2026-06-03T10:00:00.000Z',
        metadata: { origin: 'self_service' },
      },
    });

    render(<AccountPrivacyDetailPage caseId="case-1" />);

    await waitFor(() => {
      expect(getMyDataSubjectRightsCaseMock).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    expect(screen.getAllByText('Rechteänderung').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Zurück zur Datenschutzübersicht' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Datenschutzübersicht' }));
    expect(useNavigateMock).toHaveBeenCalledWith({ to: '/account/privacy' });
  });
});
