import { createHash, createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as local from '../src/access-transfer-crypto.js';
import {
  activationProof,
  bytes,
  b64,
  importOrganisationKey,
  open,
} from '../src/organisation-key-crypto.js';
import { operationSchemas } from '../src/organisation-key-contracts.js';
const published = JSON.parse(
  readFileSync(new URL('./fixtures/lifecycle_v2.json', import.meta.url), 'utf8')
);
// The cross-language vector uses the public test scalars 101 and 102.
function vectorPkcs8(ordinal: number, publicPoint: string): string {
  const point = Buffer.from(publicPoint, 'base64url');
  const scalar = Buffer.alloc(32);
  scalar.writeUInt32BE(ordinal, 28);
  return createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: point.subarray(1, 33).toString('base64url'),
      y: point.subarray(33).toString('base64url'),
      d: scalar.toString('base64url'),
    },
  })
    .export({ format: 'der', type: 'pkcs8' })
    .toString('base64url');
}
const v = Object.fromEntries(
  Object.entries(published).map(([field, value]) => {
    if (field === 'organisationTestOrdinal')
      return [
        'organisationPrivateKeyPkcs8',
        vectorPkcs8(published.organisationTestOrdinal, published.organisationPublicKey),
      ];
    if (field === 'targetTestOrdinal')
      return [
        'targetPrivateKeyPkcs8',
        vectorPkcs8(published.targetTestOrdinal, published.targetEncPub),
      ];
    return [field, value];
  })
) as typeof published;
it('reconstructs the exact approved cross-language vector from public test ordinals', () => {
  const digest = createHash('sha256')
    .update(JSON.stringify(v, null, 2) + '\n')
    .digest('hex');
  expect(digest).toBe('cc95f8e2fb33d63aa352d4139d2680b2df9e3efe0c9ef6bcdfbd92c3d25eba1c');
});
const id = {
  tenantId: v.tenantId,
  keyId: v.organisationKeyId,
  version: v.organisationVersion,
  publicKey: v.organisationPublicKey,
  fingerprint: v.organisationFingerprint,
};
const file = new Blob([
  JSON.stringify({
    ...id,
    format: 'ssf-organisation-key',
    formatVersion: 1,
    privateKeyPkcs8: v.organisationPrivateKeyPkcs8,
  }),
]);
const item = {
  conversationId: v.conversationId,
  keyId: v.keyId,
  epoch: v.epoch,
  sourceWrap: { envelope: v.sourceEnvelope, signature: v.sourceSignature },
  sourceSigner: { keyId: 'gateway', publicKey: v.gatewayPublicKey },
};
const prep = operationSchemas.prepareTransfer.output.parse({
  transferId: v.transferId,
  expiresAt: v.expiresAt,
  scopeDigest: v.scopeDigest,
  organisationKey: {
    keyId: id.keyId,
    version: id.version,
    fingerprint: id.fingerprint,
    publicKey: id.publicKey,
    createdAt: v.expiresAt,
    activatedAt: v.expiresAt,
    state: 'superseded',
  },
  targetKey: {
    userSub: v.targetUserSub,
    version: v.targetVersion,
    fingerprint: v.targetFingerprint,
    encPub: v.targetEncPub,
    sigPub: v.targetSigPub,
  },
  challengeEnvelope: v.transferChallenge,
  keys: [item],
});
it('matches Gateway activation and transfer transcripts and opens the exact same key for the selected recipient', async () => {
  const key = await importOrganisationKey(file, id);
  expect(
    await activationProof(
      key,
      id,
      {
        ...id,
        preparationId: v.preparationId,
        expiresAt: v.expiresAt,
        challengeEnvelope: v.activationChallenge,
      },
      v.actorSub,
      null
    )
  ).toBe(v.activationProof);
  expect(
    await local.transferProof(key, id, v.actorSub, prep, v.reason, [
      { ...item, envelope: v.targetEnvelope },
    ])
  ).toBe(v.transferProof);
  const { wraps, proof } = await local.rewrapTransfer(
    key,
    id,
    v.actorSub,
    prep,
    v.reason,
    [item],
    new AbortController().signal
  );
  expect(proof).toHaveLength(43);
  expect(wraps).toHaveLength(1);
  const target = await crypto.subtle.importKey(
    'pkcs8',
    bytes(v.targetPrivateKeyPkcs8),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
  expect(
    b64(
      await open(target, v.targetEncPub, wraps[0]!.envelope, 'SSF-CK-WRAP-V2', [
        v.tenantId,
        v.conversationId,
        v.keyId,
        'user',
        v.targetUserSub,
        v.targetVersion,
        bytes(v.targetFingerprint),
      ])
    )
  ).toBe(v.contentKey);
});
it('refuses substituted signatures, scope mismatches and rotated recipient material before commit', async () => {
  const key = await importOrganisationKey(file, id);
  for (const changed of [
    {
      ...prep,
      keys: [{ ...item, sourceWrap: { ...item.sourceWrap, signature: v.targetSignature } }],
    },
    { ...prep, keys: [item, item] },
    { ...prep, scopeDigest: v.resultDigest },
    { ...prep, targetKey: { ...prep.targetKey, encPub: v.organisationPublicKey } },
  ])
    await expect(
      local.rewrapTransfer(
        key,
        id,
        v.actorSub,
        changed,
        v.reason,
        [item],
        new AbortController().signal
      )
    ).rejects.toThrow();
  await expect(
    local.rewrapTransfer(key, id, v.actorSub, prep, v.reason, [], new AbortController().signal)
  ).rejects.toThrow();
});
