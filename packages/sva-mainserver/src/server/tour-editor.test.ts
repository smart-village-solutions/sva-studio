import { buildClientSchema, parse, validate, type IntrospectionQuery } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reserve: vi.fn(),
  complete: vi.fn(),
  authorize: vi.fn(),
  finalize: vi.fn(),
  fail: vi.fn(),
  access: vi.fn(),
}));
vi.mock('@sva/auth-runtime/server', () => ({
  reserveIdempotency: state.reserve,
  completeIdempotency: state.complete,
}));
vi.mock('./mutation-principal.js', () => ({
  authorizeMainserverExistingContent: state.authorize,
  finalizeMainserverMutation: state.finalize,
  finalizeMainserverMutationFailure: state.fail,
  resolveMainserverResourceAccess: state.access,
}));

import snapshot from '../generated/schema.snapshot.json';
import type { MainserverMutationActor } from './mutation-principal-types.js';
import type { ServiceContext } from './service-internals/service-context.js';
import { editableTourDocument, editTourDocument } from './tour-editor-contract.js';
import { createTourEditor, handleTourUpdate } from './tour-editor.js';

const actor = {
  instanceId: 'tenant',
  keycloakSubject: 'subject',
  actorAccountId: 'account',
  actingPrincipalType: 'user',
  mutationPrincipalContext: { actingPrincipalId: 'account', credentialFingerprint: 'credential' },
} as unknown as MainserverMutationActor;
const tour = {
  id: '42',
  revision: 'r1',
  name: 'Tour',
  description: null,
  lengthKm: 3,
  dataProvider: { id: 'provider', name: 'Mainserver' },
  geometryTourData: [{ latitude: null, longitude: 13 }],
  tourStops: [{ id: '18', name: 'Stop', description: null, geoLocation: null }],
};
const request = (body: unknown) =>
  new Request('https://studio.test/api/v1/mainserver/tours/42', {
    method: 'PATCH',
    headers: { 'Idempotency-Key': 'edit-1' },
    body: JSON.stringify(body),
  });
const setup = () => {
  const execute = vi.fn();
  const context = {
    loadValidatedInstanceConfig: vi.fn().mockResolvedValue({}),
    loadDataProviderIdentityWithConfig: vi
      .fn()
      .mockResolvedValue({ dataProvider: { id: 'provider' } }),
    executeGraphqlWithConfig: execute as ServiceContext['executeGraphqlWithConfig'],
  };
  const editor = createTourEditor(context);
  return {
    execute,
    editor,
    update: (body: unknown) => handleTourUpdate(request(body), actor, '42', editor),
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  state.reserve.mockResolvedValue({ status: 'reserved' });
  state.authorize.mockResolvedValue({});
  state.access.mockResolvedValue({ 'tours.read': true, 'tours.update': true });
});

describe('tour editor', () => {
  it('matches the Mainserver snapshot for editable reads and optimistic updates', () => {
    const schema = buildClientSchema(snapshot.data as unknown as IntrospectionQuery);
    expect(validate(schema, parse(editableTourDocument))).toEqual([]);
    expect(validate(schema, parse(editTourDocument))).toEqual([]);
  });

  it('reads and writes in the credential scope and sends only the declared patch once', async () => {
    const { execute, update } = setup();
    const patch = {
      description: null,
      geometryTourData: [],
      tourStops: [{ id: '18', geoLocation: null }, { name: 'Neuer Stopp' }],
    };
    const saved = { ...tour, revision: 'r2' };
    execute
      .mockResolvedValueOnce({ editableTour: tour })
      .mockResolvedValueOnce({ createTour: { editorialSnapshot: saved } })
      .mockResolvedValueOnce({ editableTour: saved });

    const response = await update({ expectedRevision: 'r1', patch });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: saved });
    expect(state.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tours.update',
        contentId: '42',
        item: tour,
        forceExactScopeAuthorization: true,
      })
    );
    expect(execute.mock.calls.map(([operation]) => operation.operationName)).toEqual([
      'SvaMainserverEditableTour',
      'SvaMainserverEditTour',
      'SvaMainserverEditableTour',
    ]);
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      variables: { id: '42', expectedRevision: 'r1', ...patch },
      allowRetry: false,
    });
    expect(execute.mock.calls[1]?.[0].variables).toEqual({
      id: '42',
      expectedRevision: 'r1',
      ...patch,
    });
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        contentId: '42',
      })
    );
  });

  it('does not disclose or mutate tours from a different DataProvider', async () => {
    const { execute, editor, update } = setup();
    execute.mockResolvedValue({
      editableTour: { ...tour, dataProvider: { id: 'other', name: null } },
    });

    await expect(editor.read(actor, '42')).resolves.toBeNull();
    expect((await update({ expectedRevision: 'r1', patch: { lengthKm: 4 } })).status).toBe(404);
    expect(state.authorize).not.toHaveBeenCalled();
    expect(execute.mock.calls.map(([operation]) => operation.operationName)).toEqual([
      'SvaMainserverEditableTour',
      'SvaMainserverEditableTour',
    ]);
  });

  it('rejects a fresh update without exact read access before any GraphQL write', async () => {
    const { execute, update } = setup();
    execute.mockResolvedValueOnce({ editableTour: tour });
    state.access.mockResolvedValueOnce({ 'tours.read': false, 'tours.update': true });

    const response = await update({ expectedRevision: 'r1', patch: { name: 'Other' } });

    expect(response.status).toBe(403);
    expect(response.headers.get('X-SVA-Mutation-Outcome')).toBe('not_applied');
    await expect(response.json()).resolves.toMatchObject({ error: 'forbidden' });
    expect(execute).toHaveBeenCalledOnce();
    expect(state.authorize).not.toHaveBeenCalled();
  });

  it('rejects stale client revisions and replays known failures without writing', async () => {
    const { execute, update } = setup();
    execute.mockResolvedValueOnce({ editableTour: tour });
    const body = { expectedRevision: 'stale', patch: { name: 'Other' } };
    const first = await update(body);
    expect(first.status).toBe(409);
    expect(first.headers.get('X-SVA-Mutation-Outcome')).toBe('not_applied');
    const responseBody = await first.json();
    expect(responseBody).toMatchObject({ error: 'tour_revision_conflict' });
    state.reserve.mockResolvedValueOnce({ status: 'replay', responseStatus: 409, responseBody });

    const replay = await update(body);

    expect(replay.status).toBe(409);
    expect(replay.headers.get('X-SVA-Mutation-Outcome')).toBe('not_applied');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rechecks current read and update access before returning a saved response', async () => {
    const { execute, update } = setup();
    execute.mockResolvedValue({ editableTour: tour });
    state.reserve.mockResolvedValue({
      status: 'replay',
      responseStatus: 200,
      responseBody: { data: tour },
    });
    state.access
      .mockResolvedValueOnce({ 'tours.read': true, 'tours.update': false })
      .mockResolvedValueOnce({ 'tours.read': false, 'tours.update': true })
      .mockResolvedValueOnce({ 'tours.read': true, 'tours.update': true });
    const body = { expectedRevision: 'r1', patch: { name: 'Other' } };

    for (const expectedStatus of [403, 403, 200]) {
      const response = await update(body);
      expect(response.status).toBe(expectedStatus);
      const result = await response.json();
      if (expectedStatus === 403) expect(result).not.toHaveProperty('data');
      else expect(result).toEqual({ data: tour });
    }
    expect(state.access).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        item: tour,
        actions: ['tours.read', 'tours.update'],
        forceExactScopeActions: ['tours.read', 'tours.update'],
      })
    );
    expect(
      execute.mock.calls.every(
        ([operation]) => operation.operationName === 'SvaMainserverEditableTour'
      )
    ).toBe(true);
    expect(state.authorize).not.toHaveBeenCalled();
  });

  it('maps a concurrent Mainserver conflict without another GraphQL mutation', async () => {
    const { execute, update } = setup();
    execute
      .mockResolvedValueOnce({ editableTour: tour })
      .mockImplementationOnce(({ mapErrorCode }) => {
        throw mapErrorCode('TOUR_REVISION_CONFLICT');
      });

    const response = await update({ expectedRevision: 'r1', patch: { name: 'Other' } });

    expect(response.status).toBe(409);
    expect(response.headers.get('X-SVA-Mutation-Outcome')).toBe('not_applied');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(state.fail).toHaveBeenCalledWith(expect.objectContaining({ providerOutcome: 'failed' }));
  });

  it('returns partial success after failed readback without retrying a confirmed provider write', async () => {
    const { execute, update } = setup();
    execute
      .mockResolvedValueOnce({ editableTour: tour })
      .mockResolvedValueOnce({ createTour: { editorialSnapshot: { ...tour, revision: 'r2' } } })
      .mockRejectedValueOnce(new Error('Readback unavailable'));

    const response = await update({ expectedRevision: 'r1', patch: { name: 'Other' } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: 'tour_update_unverified',
      partialSuccess: true,
      details: { contentId: '42' },
    });
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'succeeded',
        reconciliationStatus: 'reconciliation_required',
      })
    );
    expect(
      execute.mock.calls.filter(
        ([operation]) => operation.operationName === 'SvaMainserverEditTour'
      )
    ).toHaveLength(1);
  });

  it('rejects an undeclared field before reservation or a provider call', async () => {
    const { execute, update } = setup();

    const response = await update({ expectedRevision: 'r1', patch: { visible: true } });

    expect(response.status).toBe(400);
    expect(response.headers.get('X-SVA-Mutation-Outcome')).toBe('not_applied');
    expect(state.reserve).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
