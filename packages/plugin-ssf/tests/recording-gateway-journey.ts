/** Disposable full-stack fixture. Uses the production plugin handlers and browser WebCrypto protocol. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { SsfRecordingGatewayRequest } from '@sva/plugin-sdk';
import { createRecordingKeyHandlers } from '../src/server/organisation-keys.js';
import { operationSchemas, pluginRecordingBase } from '../src/organisation-key-contracts.js';
import {
  generateOrganisationKey,
  createOrganisationKeyFile,
  importOrganisationKey,
  activationProof,
} from '../src/organisation-key-crypto.js';
import { rewrapTransfer } from '../src/access-transfer-crypto.js';

export const recordingGatewayJourney = async (input: {
  tenant: string;
  actor: string;
  realm: string;
  otherTenant: string;
  otherActor: string;
  otherRealm: string;
  directory: string;
  seed: string;
  forward: (
    which: 'current' | 'other',
    id: string,
    request: Request,
    operation: SsfRecordingGatewayRequest
  ) => Promise<Response>;
}) => {
  const owner = 'journey-employee',
    recipient = 'journey-recipient';
  const permissions = ['ssf.configuration.tenant.manage', 'ssf.recording.access.transfer'];
  const directory = (grants: string[]) =>
    writeFileSync(
      input.directory,
      JSON.stringify({
        tenants: [
          {
            id: input.tenant,
            realm: input.realm,
            users: [
              { sub: input.actor, permissions: grants },
              { sub: owner, permissions: ['ssf.recording.request'] },
              { sub: recipient, permissions: ['ssf.recording.review'] },
            ],
          },
          {
            id: input.otherTenant,
            realm: input.otherRealm,
            users: [{ sub: input.otherActor, permissions }],
          },
        ],
      }),
      { mode: 0o600 }
    );
  directory(permissions);
  const handlers = createRecordingKeyHandlers();
  const request = async (
    name: keyof typeof operationSchemas,
    params: {
      id?: string;
      sub?: string;
      query?: string;
      body?: unknown;
      which?: 'current' | 'other';
    } = {}
  ) => {
    const op = operationSchemas[name],
      path =
        op.path.replace('$id', params.id ?? '').replace('$sub', params.sub ?? '') +
        (params.query ?? '');
    const req = new Request('https://studio.test' + pluginRecordingBase + path, {
      method: op.method,
      ...(params.body ? { body: JSON.stringify(params.body) } : {}),
    });
    const which = params.which ?? 'current';
    const handler = handlers[op.id];
    if (!handler) throw new Error('fixture_handler_missing');
    return handler({
      scope: 'tenant',
      sessionId: 'fixture-session',
      pluginId: 'ssf',
      handlerId: op.id,
      request: req,
      pathParams: { id: params.id ?? '', sub: params.sub ?? '' },
      actor: {
        id: which === 'current' ? input.actor : input.otherActor,
        instanceId: which === 'current' ? input.tenant : input.otherTenant,
        roles: [],
      },
      forwardSsfRecordingRequest: (operation) => input.forward(which, op.id, req, operation),
    });
  };
  const json = async (response: Response) => {
    const data = await response.json();
    if (!response.ok)
      throw new Error('Gateway fixture HTTP ' + response.status + ' ' + String(data?.error?.code));
    return data;
  };
  const activate = async (previous: string | null) => {
    const generated = await generateOrganisationKey();
    const prep = operationSchemas.prepareKey.output.parse(
      await json(
        await request('prepareKey', {
          body: { publicKey: generated.publicKey, expectedActiveKeyId: previous },
        })
      )
    );
    const id = {
      tenantId: input.tenant,
      keyId: prep.keyId,
      version: prep.version,
      publicKey: generated.publicKey,
      fingerprint: prep.fingerprint,
    };
    const file = new Blob([await createOrganisationKeyFile(generated, id)]);
    const privateKey = await importOrganisationKey(file, id),
      proof = await activationProof(privateKey, id, prep, input.actor, previous);
    const body = { proof, savedConfirmation: true };
    expect(
      (await request('activate', { id: prep.preparationId, body, which: 'other' })).status
    ).toBe(404);
    const result = operationSchemas.activate.output.parse(
      await json(await request('activate', { id: prep.preparationId, body }))
    );
    expect(result.keyId).toBe(id.keyId);
    return { id, file, body, prep };
  };
  expect(operationSchemas.list.output.parse(await json(await request('list'))).keys).toEqual([]);
  const old = await activate(null);
  const seeded = JSON.parse(
    execFileSync(input.seed, [input.tenant, owner, recipient, old.id.keyId], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  );
  const next = await activate(old.id.keyId);
  expect(
    operationSchemas.activate.output.parse(
      await json(await request('activate', { id: old.prep.preparationId, body: old.body }))
    ).keyId
  ).toBe(old.id.keyId);
  const history = operationSchemas.list.output.parse(await json(await request('list')));
  expect(history.activeKeyId).toBe(next.id.keyId);
  expect(history.keys.find((k) => k.keyId === old.id.keyId)?.state).toBe('superseded');
  const target = operationSchemas.target.output.parse(
    await json(await request('target', { sub: recipient }))
  );
  const page = operationSchemas.candidates.output.parse(
    await json(await request('candidates', { query: '?employeeSub=' + owner }))
  );
  const candidate = page.items.find((c) => c.conversationId === seeded.conversationId);
  expect(candidate?.keyScopes).toEqual([{ keyId: seeded.keyId, organisationKeyId: old.id.keyId }]);
  const reason = 'Fixture transfer';
  const prep = operationSchemas.prepareTransfer.output.parse(
    await json(
      await request('prepareTransfer', {
        body: {
          conversationIds: [seeded.conversationId],
          organisationKeyId: old.id.keyId,
          targetUserSub: recipient,
          expectedTargetKeyVersion: target.version,
          expectedTargetFingerprint: target.fingerprint,
          reason,
        },
      })
    )
  );
  const key = await importOrganisationKey(old.file, old.id);
  const body = await rewrapTransfer(
    key,
    old.id,
    input.actor,
    prep,
    reason,
    [{ conversationId: seeded.conversationId, keyId: seeded.keyId }],
    new AbortController().signal
  );
  expect((await request('commit', { id: prep.transferId, body, which: 'other' })).status).toBe(404);
  directory(['ssf.configuration.tenant.manage']);
  expect((await request('commit', { id: prep.transferId, body })).status).toBe(403);
  directory(permissions);
  const result = operationSchemas.commit.output.parse(
    await json(await request('commit', { id: prep.transferId, body }))
  );
  expect(result.grantedKeyIds).toEqual([seeded.keyId]);
  expect(await json(await request('commit', { id: prep.transferId, body }))).toEqual(result);
};
