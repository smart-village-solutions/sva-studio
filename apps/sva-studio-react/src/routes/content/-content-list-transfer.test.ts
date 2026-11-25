import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadBatchOwnershipTargets,
  runTransferJob,
  selectTransferCandidate,
  type TransferJob,
  type TransferSelectionItem,
} from './-content-list-transfer';

const news = (id: string): TransferSelectionItem => ({
  id,
  contentType: 'news.article',
  title: id,
  historyRef: `mainserver:news:${id}`,
  principal: 'user',
});

const setup = () => {
  const initial: TransferJob = {
    target: { type: 'organization', id: 'target' },
    binding: 'v1.test',
    operations: ['1', '2', '3'].map((id) => ({
      item: news(id),
      operationId: `operation-${id}`,
      status: 'queued',
    })),
  };
  let stored = initial;
  const commit = (job: TransferJob) => {
    stored = job;
  };
  return { initial, commit, read: () => stored };
};

describe('batch ownership transfer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('represents a shared Mainserver GenericItem by its dedicated content type', () => {
    const generic = {
      ...news('51'),
      contentType: 'generic-items.generic-item',
      historyRef: 'mainserver:generic-items:51',
    };
    const project = { ...generic, id: 'core-project-id', contentType: 'projects.project' };
    const selection = new Map<string, TransferSelectionItem>();
    selectTransferCandidate(selection, generic);
    selectTransferCandidate(selection, project);
    selectTransferCandidate(selection, generic);
    expect([...selection.values()]).toEqual([project]);
  });

  it.each(['forbidden', 'content_transfer_source_changed'])(
    'uses another record for target search after %s and binds the subsequent job to its context',
    async (error) => {
      const target = { principal: { type: 'organization', id: 'target' }, displayName: 'Redaktion' };
      const fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/1/targets')) {
          return Response.json({ error }, { status: error === 'forbidden' ? 403 : 409 });
        }
        return Response.json(
          { data: [target], pagination: { total: 1 } },
          { headers: { 'X-SVA-Context-Binding': 'v1.target-scope' } }
        );
      });
      vi.stubGlobal('fetch', fetch);
      const binding = vi.fn();
      await expect(
        loadBatchOwnershipTargets(
          [news('1'), news('2')],
          { type: 'organization', page: 1, pageSize: 10 },
          binding
        )
      ).resolves.toEqual({ items: [target], total: 1 });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1]?.[0]).toContain('selection=batch');
      expect(binding).toHaveBeenCalledExactlyOnceWith('v1.target-scope');
    }
  );

  it('shows individual rejections and only marks confirmed journal entries as transferred', async () => {
    const { initial, commit, read } = setup();
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        const headers = new Headers(init.headers);
        const id = url.split('/').at(-2);
        expect(read().operations.find((entry) => entry.item.id === id)?.status).toBe('reconciling');
        expect(headers.get('x-sva-operation-id')).toBe(`operation-${id}`);
        expect(headers.get('x-sva-context-binding')).toBe(initial.binding);
        expect(JSON.parse(String(init.body))).toEqual({ targetPrincipal: initial.target });
        return id === '2'
          ? Response.json({ error: 'forbidden' }, { status: 403 })
          : Response.json({});
      }
      return Response.json({
        data: {
          providerOutcome: 'succeeded',
          reconciliationStatus: url.endsWith('operation-1')
            ? 'complete'
            : 'reconciliation_required',
        },
      });
    });
    vi.stubGlobal('fetch', fetch);
    await runTransferJob(initial, true, new AbortController().signal, commit);
    expect(read().operations.map(({ status }) => status)).toEqual([
      'succeeded',
      'rejected',
      'reconciling',
    ]);
  });

  it('distinguishes an earlier transfer blocking the write from an uncertain current write', async () => {
    const { initial, commit, read } = setup();
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== 'POST')
        return Response.json({ error: 'database_unavailable' }, { status: 503 });
      const id = String(input).split('/').at(-2);
      return Response.json(
        { error: 'content_transfer_reconciliation_required' },
        { status: 409, headers: id === '1' ? { 'X-SVA-Mutation-Outcome': 'not_applied' } : {} }
      );
    });
    vi.stubGlobal('fetch', fetch);

    await runTransferJob(initial, true, new AbortController().signal, commit);

    expect(read().operations.map(({ status }) => status)).toEqual([
      'rejected', 'reconciling', 'reconciling',
    ]);
    expect(fetch.mock.calls.map(([input]) => String(input))).not.toContain(
      '/api/v1/mainserver/content-ownership/operations/operation-1'
    );
  });

  it('lets the user resume a missing operation with its original ID after a transport failure', async () => {
    const { initial, commit, read } = setup();
    const sent: Array<string | null> = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        sent.push(new Headers(init.headers).get('x-sva-operation-id'));
        if (sent.length === 1) throw new TypeError('Network error');
        return Response.json({}, { status: 200 });
      }
      expect(String(input)).toContain('/operations/operation-1');
      return sent.length === 1
        ? Response.json({ error: 'operation_not_found' }, { status: 404 })
        : Response.json({
            data: { providerOutcome: 'succeeded', reconciliationStatus: 'complete' },
          });
    });
    vi.stubGlobal('fetch', fetch);
    const job = { ...initial, operations: initial.operations.slice(0, 1) };
    const signal = new AbortController().signal;

    await runTransferJob(job, true, signal, commit);
    expect(read().operations[0]?.status).toBe('queued');
    await runTransferJob(read(), false, signal, commit);
    expect(sent).toEqual(['operation-1']);

    await runTransferJob(read(), true, signal, commit);
    expect(sent).toEqual(['operation-1', 'operation-1']);
    expect(read().operations[0]?.status).toBe('succeeded');
  });

  it('uses the journal outcome after a target verification error', async () => {
    const { initial, commit, read } = setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Response.json({ error: 'content_transfer_target_verification_failed' }, { status: 503 });
      }
      if (String(input).endsWith('operation-1')) {
        return Response.json({ data: { providerOutcome: 'failed', reconciliationStatus: 'complete' } });
      }
      return String(input).endsWith('operation-2')
        ? Response.json({ data: { providerOutcome: 'pending', reconciliationStatus: 'pending' } })
        : Response.json({ data: { providerOutcome: 'failed', reconciliationStatus: 'reconciliation_required' } });
    }));

    await runTransferJob(initial, true, new AbortController().signal, commit);

    expect(read().operations.map(({ status }) => status)).toEqual([
      'rejected',
      'reconciling',
      'reconciling',
    ]);
  });

  it('resumes work after interruption without resending an uncertain request', async () => {
    const { initial, commit, read } = setup();
    const controller = new AbortController();
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
          sent.push(url);
          if (sent.length === 1) controller.abort();
        }
        return Response.json({
          data: { providerOutcome: 'succeeded', reconciliationStatus: 'complete' },
        });
      })
    );
    await runTransferJob(initial, true, controller.signal, commit);
    expect(read().operations.map(({ status }) => status)).toEqual([
      'reconciling',
      'queued',
      'queued',
    ]);

    await runTransferJob(read(), true, new AbortController().signal, commit);
    expect(sent.map((url) => url.split('/').at(-2))).toEqual(['1', '2', '3']);
    expect(read().operations.every(({ status }) => status === 'succeeded')).toBe(true);
  });
});
