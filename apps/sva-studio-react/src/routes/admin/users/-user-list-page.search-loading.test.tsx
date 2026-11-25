import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../../../i18n';
import { UserListPage } from './-user-list-page';

// Exercises the real useUsers hook and StudioDataTable; only the HTTP boundary is mocked.
const listUsersMock = vi.fn();
// Stable like the real AuthProvider value, so it does not retrigger list requests per render.
const authValue = vi.hoisted(() => ({
  user: {
    id: 'user-admin',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
    permissionActions: ['iam.user.read', 'iam.user.write'],
  },
  refreshSession: async () => undefined,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../lib/iam-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/iam-api')>()),
  listUsers: (...args: unknown[]) => listUsersMock(...args),
}));

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../../hooks/use-iam-resource-access', () => {
  const allowed = { status: 'allowed', reason: 'allowed_by_permission' };
  return {
    useIamResourceAccess: () => ({
      read: allowed,
      create: allowed,
      update: allowed,
      delete: allowed,
    }),
    isIamAccessAllowed: (decision: { status: string }) => decision.status === 'allowed',
  };
});

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type ListUsersResponse = {
  data: Array<{
    id: string;
    keycloakSubject: string;
    displayName: string;
    email: string;
    status: 'active';
    roles: [];
  }>;
  pagination: { page: number; pageSize: number; total: number };
};

const listResponse = (...displayNames: string[]): ListUsersResponse => ({
  data: displayNames.map((displayName, index) => ({
    id: `user-${displayName}`,
    keycloakSubject: `subject-${index}`,
    displayName,
    email: `${displayName.split(' ')[0]?.toLowerCase()}@example.com`,
    status: 'active',
    roles: [],
  })),
  pagination: { page: 1, pageSize: 25, total: displayNames.length },
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe('UserListPage search while results are loading', () => {
  const pendingSearches = new Map<string, ReturnType<typeof createDeferred<ListUsersResponse>>>();

  beforeEach(() => {
    pendingSearches.clear();
    listUsersMock.mockReset();
    listUsersMock.mockImplementation(({ search }: { search?: string }) => {
      if (!search) {
        return Promise.resolve(listResponse('Anna Admin', 'Maria Meyer', 'Max Mustermann'));
      }
      const deferred = createDeferred<ListUsersResponse>();
      pendingSearches.set(search, deferred);
      return deferred.promise;
    });
  });

  afterEach(cleanup);

  // Rows render in both the wide table and the compact card layout; assert on the table.
  const findInTable = async (text: string) =>
    within(await screen.findByRole('table')).findByText(text);

  const waitForSearchRequest = (search: string) =>
    waitFor(() => expect(pendingSearches.has(search)).toBe(true));

  it('keeps typing and focus in the search field while slow and overlapping searches resolve', async () => {
    render(<UserListPage />);
    expect(await findInTable('Anna Admin')).toBeTruthy();

    const search = screen.getByLabelText<HTMLInputElement>(t('admin.users.filters.searchLabel'));
    search.focus();
    fireEvent.change(search, { target: { value: 'Ma' } });

    // Pause longer than the debounce: the first search request is now in flight.
    await waitForSearchRequest('Ma');
    expect(screen.getByText(t('content.messages.loading'))).toBeTruthy();
    // The count of the previous result is not shown while the new search loads.
    expect(screen.queryByText(t('admin.users.messages.resultCount', { count: 3 }))).toBeNull();
    expect(screen.getByLabelText(t('admin.users.filters.searchLabel'))).toBe(search);
    expect(document.activeElement).toBe(search);

    fireEvent.change(search, { target: { value: 'Max' } });
    await waitForSearchRequest('Max');
    expect(search.value).toBe('Max');
    expect(document.activeElement).toBe(search);

    // Responses complete in reverse order: the newest succeeds, the outdated one fails.
    await act(async () => pendingSearches.get('Max')?.resolve(listResponse('Max Mustermann')));
    await act(async () =>
      pendingSearches
        .get('Ma')
        ?.reject({ status: 503, code: 'database_unavailable', message: 'stale' })
    );

    expect(within(screen.getByRole('table')).getByText('Max Mustermann')).toBeTruthy();
    expect(screen.queryAllByText('Maria Meyer')).toHaveLength(0);
    expect(screen.queryByText(t('content.messages.loading'))).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement).toBe(search);
    expect(search.value).toBe('Max');
  });

  it('ignores an outdated search result that arrives after the newest one', async () => {
    render(<UserListPage />);
    expect(await findInTable('Anna Admin')).toBeTruthy();

    const search = screen.getByLabelText<HTMLInputElement>(t('admin.users.filters.searchLabel'));
    fireEvent.change(search, { target: { value: 'Ma' } });
    await waitForSearchRequest('Ma');
    fireEvent.change(search, { target: { value: 'Max' } });
    await waitForSearchRequest('Max');

    await act(async () => pendingSearches.get('Max')?.resolve(listResponse('Max Mustermann')));
    await act(async () =>
      pendingSearches.get('Ma')?.resolve(listResponse('Maria Meyer', 'Max Mustermann'))
    );

    expect(within(screen.getByRole('table')).getByText('Max Mustermann')).toBeTruthy();
    expect(screen.queryAllByText('Maria Meyer')).toHaveLength(0);
    expect(screen.getByText(t('admin.users.messages.resultCount', { count: 1 }))).toBeTruthy();
  });

  it('announces the empty state once when a search has no results', async () => {
    render(<UserListPage />);
    expect(await findInTable('Anna Admin')).toBeTruthy();

    const search = screen.getByLabelText<HTMLInputElement>(t('admin.users.filters.searchLabel'));
    fireEvent.change(search, { target: { value: 'zzz' } });
    await waitForSearchRequest('zzz');
    await act(async () => pendingSearches.get('zzz')?.resolve(listResponse()));

    const emptyMessage = screen.getByText(t('admin.users.messages.emptyState'));
    expect(
      screen.getAllByRole('status').filter((status) => status.contains(emptyMessage))
    ).toHaveLength(1);
  });
});
