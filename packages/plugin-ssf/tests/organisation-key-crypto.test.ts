import { expect, it } from 'vitest';
import * as keys from '../src/organisation-key-crypto.js';
const tenant = 'tenant-a',
  keyId = '12345678-1234-4234-8234-123456789001';
it('exports an exact unencrypted file and imports only a bounded matching organisation key', async () => {
  const draft = await keys.generateOrganisationKey();
  const fingerprint = await keys.organisationFingerprint(tenant, keyId, 1, draft.publicKey);
  const metadata = { tenantId: tenant, keyId, version: 1, publicKey: draft.publicKey, fingerprint };
  const file = await keys.createOrganisationKeyFile(draft, metadata);
  const body = JSON.parse(file);
  expect(Object.keys(body).sort()).toEqual(
    [
      'format',
      'formatVersion',
      'tenantId',
      'keyId',
      'version',
      'publicKey',
      'fingerprint',
      'privateKeyPkcs8',
    ].sort()
  );
  expect((await keys.importOrganisationKey(new Blob([file]), metadata)).extractable).toBe(false);
  const other = await keys.generateOrganisationKey();
  const otherFile = await keys.createOrganisationKeyFile(other, {
    ...metadata,
    publicKey: other.publicKey,
    fingerprint: await keys.organisationFingerprint(tenant, keyId, 1, other.publicKey),
  });
  for (const bad of [
    'passphrase file',
    file.replace(tenant, 'other-tenant'),
    JSON.stringify({ ...body, extra: 1 }),
    JSON.stringify({ ...body, privateKeyPkcs8: JSON.parse(otherFile).privateKeyPkcs8 }),
    ' '.repeat(65537),
  ])
    await expect(keys.importOrganisationKey(new Blob([bad]), metadata)).rejects.toThrow(
      'INVALID_KEY'
    );
});
it('authenticates ECIES possession challenge and binds save, actor and previous active ID', async () => {
  const draft = await keys.generateOrganisationKey();
  const meta = {
    tenantId: tenant,
    keyId,
    version: 1,
    publicKey: draft.publicKey,
    fingerprint: await keys.organisationFingerprint(tenant, keyId, 1, draft.publicKey),
  };
  const file = await keys.createOrganisationKeyFile(draft, meta),
    key = await keys.importOrganisationKey(new Blob([file]), meta);
  const expiresAt = '2026-11-18T15:00:00.000000Z',
    id = crypto.randomUUID(),
    nonce = crypto.getRandomValues(new Uint8Array(32));
  const challenge = await keys.seal('SSF-ORG-POSSESSION-V1', meta.publicKey, nonce, [
    tenant,
    'actor',
    id,
    'activation',
    keyId,
    1,
    expiresAt,
  ]);
  const prep = { preparationId: id, expiresAt, challengeEnvelope: challenge, ...meta };
  const proof = await keys.activationProof(key, meta, prep, 'actor', null);
  expect(proof).toHaveLength(43);
  expect(await keys.activationProof(key, meta, prep, 'actor', keyId)).not.toBe(proof);
  await expect(keys.activationProof(key, meta, prep, 'other', null)).rejects.toThrow();
});

it('checks both coordinates of the stored public key', async () => {
  const draft = await keys.generateOrganisationKey();
  const fingerprint = await keys.organisationFingerprint(tenant, keyId, 1, draft.publicKey);
  const meta = { tenantId: tenant, keyId, version: 1, publicKey: draft.publicKey, fingerprint };
  const file = JSON.parse(await keys.createOrganisationKeyFile(draft, meta));
  const point = keys.bytes(draft.publicKey);
  const y = BigInt('0x' + Buffer.from(point.slice(33)).toString('hex'));
  const field = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
  point.set(Buffer.from((field - y).toString(16).padStart(64, '0'), 'hex'), 33);
  const publicKey = keys.b64(point);
  const opposite = {
    ...meta,
    publicKey,
    fingerprint: await keys.organisationFingerprint(tenant, keyId, 1, publicKey),
  };
  await expect(
    keys.importOrganisationKey(new Blob([JSON.stringify({ ...file, ...opposite })]), opposite)
  ).rejects.toThrow('INVALID_KEY');
});
