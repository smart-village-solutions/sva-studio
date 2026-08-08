import type { IamContentListItem, IamContentStatus } from '@sva/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const statusMutation = vi.hoisted(() => ({
  supported: vi.fn<(contentType: string) => readonly IamContentStatus[]>(),
  update: vi.fn(),
}));

vi.mock('../../lib/content-status-mutation', () => ({
  getSupportedQuickStatuses: statusMutation.supported,
  updateMainserverContentStatus: statusMutation.update,
}));

import { ContentStatusBadge, ContentStatusDialog } from './-content-status-dialog';

const item = {
  id: 'news-1',
  instanceId: 'instance-1',
  contentType: 'news.article',
  title: 'Rathausmeldung',
  createdAt: '2026-08-01T08:00:00.000Z',
  createdBy: 'editor',
  updatedAt: '2026-08-02T08:00:00.000Z',
  updatedBy: 'editor',
  authorDisplayMode: 'organization',
  author: 'Redaktion',
  payload: null,
  status: 'published',
  validationState: 'valid',
  historyRef: 'mainserver:news:news-1',
  access: {
    state: 'editable',
    canRead: true,
    canCreate: true,
    canUpdate: true,
    organizationIds: [],
    sourceKinds: [],
  },
} satisfies IamContentListItem;

describe('ContentStatusDialog', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    statusMutation.supported.mockReturnValue(['draft', 'published']);
  });

  it('renders every shared status with a distinct semantic color', () => {
    const statuses = [
      ['draft', 'Entwurf', 'border-slate-400'],
      ['in_review', 'In Prüfung', 'border-amber-400'],
      ['approved', 'Freigegeben', 'border-sky-400'],
      ['published', 'Veröffentlicht', 'border-emerald-500'],
      ['archived', 'Archiviert', 'border-rose-400'],
    ] as const;

    render(
      <div>
        {statuses.map(([status]) => (
          <ContentStatusBadge key={status} status={status} />
        ))}
      </div>
    );

    statuses.forEach(([_status, label, className]) => {
      expect(screen.getByText(label).className).toContain(className);
    });
  });

  it('keeps unsupported and read-only records non-interactive', () => {
    const { rerender } = render(
      <ContentStatusDialog
        item={item}
        canUpdate={false}
        actingPrincipalType="organization"
        onUpdated={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Veröffentlicht')).toBeTruthy();

    statusMutation.supported.mockReturnValue([]);
    rerender(
      <ContentStatusDialog
        item={item}
        canUpdate
        actingPrincipalType="organization"
        onUpdated={vi.fn()}
      />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('closes without a mutation when the current status is selected', async () => {
    render(
      <ContentStatusDialog
        item={item}
        canUpdate
        actingPrincipalType="organization"
        onUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Status von Rathausmeldung ändern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlicht Aktuell' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(statusMutation.update).not.toHaveBeenCalled();
  });

  it('disables actions while saving, refreshes, and closes after success', async () => {
    let resolveMutation: (() => void) | undefined;
    statusMutation.update.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveMutation = resolve;
      })
    );
    const onUpdated = vi.fn(async () => undefined);

    render(
      <ContentStatusDialog
        item={item}
        canUpdate
        actingPrincipalType="organization"
        onUpdated={onUpdated}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Status von Rathausmeldung ändern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf' }));

    expect(screen.getByRole('button', { name: 'Entwurf' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Abbrechen' }).hasAttribute('disabled')).toBe(true);
    expect(statusMutation.update).toHaveBeenCalledWith(item, 'draft', 'organization');

    resolveMutation?.();
    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows an error and restores all actions after a failed mutation', async () => {
    statusMutation.update.mockRejectedValue(new Error('network'));

    render(
      <ContentStatusDialog item={item} canUpdate actingPrincipalType="user" onUpdated={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Status von Rathausmeldung ändern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf' }));

    expect(await screen.findByText('Der Status konnte nicht geändert werden.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entwurf' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Abbrechen' }).hasAttribute('disabled')).toBe(false);
  });
});
