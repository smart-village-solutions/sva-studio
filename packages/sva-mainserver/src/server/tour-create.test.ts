import { buildClientSchema, parse, validate, type IntrospectionQuery } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';

import snapshot from '../generated/schema.snapshot.json';
import type { MainserverMutationActor } from './mutation-principal-types.js';
import type { ServiceContext } from './service-internals/service-context.js';

const state = vi.hoisted(() => ({
  reserve: vi.fn(),
  complete: vi.fn(),
  authorize: vi.fn(),
  finalize: vi.fn(),
  fail: vi.fn(),
  binding: vi.fn(),
}));
vi.mock('@sva/auth-runtime/server', () => ({
  reserveIdempotency: state.reserve,
  completeIdempotency: state.complete,
}));
vi.mock('./mutation-principal.js', () => ({
  authorizeMainserverCreateForPrincipal: state.authorize,
  finalizeMainserverMutation: state.finalize,
  finalizeMainserverMutationFailure: state.fail,
  recordCreatedMainserverDataProvider: state.binding,
}));

import { createTourDraftDocument, handleTourCreate } from './tour-create.js';

const actor: MainserverMutationActor = {
  instanceId: 'tenant',
  actorAccountId: 'account',
  keycloakSubject: 'user',
  operationExternalId: 'operation',
  mutationPrincipalContext: {
    version: 1,
    instanceId: 'tenant',
    actorAccountId: 'account',
    keycloakSubject: 'user',
    actingPrincipalType: 'user',
    actingPrincipalId: 'account',
    credentialSource: 'user',
    credentialFingerprint: 'binding',
  },
};
const draft = { name: 'Tour', lengthKm: 2, visible: false };
const request = (input = draft) =>
  new Request('https://studio.test/api/v1/mainserver/tours', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'operation' },
    body: JSON.stringify(input),
  });
const setup = (visible = false) => {
  const created = { id: '42', visible: false, dataProvider: { id: 'provider' } };
  const execute = vi.fn().mockResolvedValue({ createTour: created });
  const detail = vi.fn().mockResolvedValue({ ...created, visible });
  const context = {
    loadValidatedInstanceConfig: vi.fn().mockResolvedValue({}),
    loadDataProviderIdentityWithConfig: vi
      .fn()
      .mockResolvedValue({ dataProvider: { id: 'provider' } }),
    executeGraphqlWithConfig: execute as ServiceContext['executeGraphqlWithConfig'],
  };
  return {
    execute,
    detail,
    identity: context.loadDataProviderIdentityWithConfig,
    create: (input?: typeof draft) =>
      handleTourCreate(request(input), actor, context, { list: vi.fn(), detail }, {
        user: { id: 'user', instanceId: 'tenant' },
      } as AuthenticatedRequestContext),
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  state.reserve.mockResolvedValue({ status: 'reserved' });
  state.authorize.mockResolvedValue({});
  state.binding.mockResolvedValue({ outcome: 'confirmed' });
});

describe('Tour draft creation', () => {
  it('uses a snapshot-backed mutation and reads back after exactly one write', async () => {
    const schema = buildClientSchema(snapshot.data as unknown as IntrospectionQuery);
    expect(validate(schema, parse(createTourDraftDocument))).toEqual([]);
    const { create, execute, detail } = setup();
    expect((await create()).status).toBe(201);
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        operationName: 'SvaMainserverCreateTourDraft',
        document: expect.stringContaining('forceCreate: true'),
        allowRetry: false,
        variables: draft,
      }),
      {}
    );
    expect(detail).toHaveBeenCalledExactlyOnceWith(actor, '42');
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        contentId: '42',
      })
    );
  });

  it('reports partial success on inconsistent readback and does not issue a visibility mutation', async () => {
    const { create, execute } = setup(true);
    const response = await create();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'tour_draft_unverified',
      partialSuccess: true,
      details: { contentId: '42' },
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ reconciliationStatus: 'reconciliation_required', contentId: '42' })
    );
  });

  it('keeps the write ambiguous after an upstream error and does not repeat it', async () => {
    const { create, execute, detail } = setup();
    const upstreamFailure = new Error('transport closed');
    execute.mockRejectedValueOnce(upstreamFailure);

    const response = await create();

    expect(response.ok).toBe(false);
    expect(response.headers.get('X-SVA-Mutation-Outcome')).not.toBe('not_applied');
    expect(execute).toHaveBeenCalledOnce();
    expect(detail).not.toHaveBeenCalled();
    expect(state.fail).toHaveBeenCalledWith(
      expect.objectContaining({ providerOutcome: 'unknown', error: upstreamFailure })
    );
  });

  it('reports reconciliation without another write if the draft is verified but binding fails', async () => {
    const { create, execute } = setup();
    state.binding.mockResolvedValueOnce({ outcome: 'conflict' });
    const response = await create();

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { id: '42', visible: false },
      meta: { reconciliationStatus: 'reconciliation_required' },
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('ends before any provider write if the key is reused or the principal is denied', async () => {
    const { create, execute, identity } = setup();
    state.reserve.mockResolvedValueOnce({ status: 'conflict', message: 'idempotency conflict' });
    expect((await create()).status).toBe(409);
    expect(state.authorize).not.toHaveBeenCalled();

    state.authorize.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));
    expect((await create()).status).toBe(403);
    expect(identity).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects invalid input and replays an already reserved operation without sending a write', async () => {
    const { create, execute } = setup();
    expect((await create({ ...draft, visible: true })).status).toBe(400);
    expect(state.reserve).not.toHaveBeenCalled();
    state.reserve.mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 201,
      responseBody: { data: { id: '42' } },
    });
    expect((await create()).status).toBe(201);
    expect(execute).not.toHaveBeenCalled();
  });
});
