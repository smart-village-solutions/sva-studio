import {
  fileSchema,
  type Activation,
  type Envelope,
  type KeyIdentity,
} from './organisation-key-contracts.js';

const utf8 = new TextEncoder();
const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
export type Field = string | number | Uint8Array<ArrayBuffer>;
export const bytes = (value: string) => {
  const raw = Uint8Array.from(atob(value.replace(/-/gu, '+').replace(/_/gu, '/')), (c) =>
    c.charCodeAt(0)
  );
  if (b64(raw) !== value) throw new Error('INVALID_KEY');
  return raw;
};
export const b64 = (value: Uint8Array) =>
  btoa(Array.from(value, (c) => String.fromCharCode(c)).join(''))
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');
const concat = (...values: Uint8Array[]) => {
  const result = new Uint8Array(values.reduce((n, v) => n + v.length, 0));
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
};
export const enc = (...fields: Field[]) =>
  concat(
    ...fields.map((field) => {
      const raw = field instanceof Uint8Array ? field : utf8.encode(String(field));
      if (raw.length > 65535) throw new Error('INVALID_KEY');
      return concat(Uint8Array.of(raw.length >> 8, raw.length & 255), raw);
    })
  );
export const sha = async (value: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', value));
export const organisationFingerprint = async (
  tenant: string,
  id: string,
  version: number,
  pub: string
) => b64(await sha(enc('SSF-ORG-KEY-V1', tenant, id, version, bytes(pub))));
const pair = () => crypto.subtle.generateKey(ecdh, true, ['deriveBits']);
const rawPublic = async (key: CryptoKey) =>
  new Uint8Array(await crypto.subtle.exportKey('raw', key));
export const generateOrganisationKey = async () => {
  const generated = await pair();
  return { privateKey: generated.privateKey, publicKey: b64(await rawPublic(generated.publicKey)) };
};
export const createOrganisationKeyFile = async (
  draft: Awaited<ReturnType<typeof generateOrganisationKey>>,
  identity: KeyIdentity
) => {
  if (
    identity.publicKey !== draft.publicKey ||
    (await organisationFingerprint(
      identity.tenantId,
      identity.keyId,
      identity.version,
      draft.publicKey
    )) !== identity.fingerprint
  )
    throw new Error('INVALID_KEY');
  const exported = new Uint8Array(await crypto.subtle.exportKey('pkcs8', draft.privateKey));
  try {
    return JSON.stringify(
      fileSchema.parse({
        ...identity,
        format: 'ssf-organisation-key',
        formatVersion: 1,
        privateKeyPkcs8: b64(exported),
      })
    );
  } finally {
    exported.fill(0);
  }
};
const shared = async (privateKey: CryptoKey, peer: Uint8Array<ArrayBuffer>) => {
  const publicKey = await crypto.subtle.importKey('raw', peer, ecdh, false, []);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  );
};
export const importOrganisationKey = async (
  file: Blob,
  expected: KeyIdentity
): Promise<CryptoKey> => {
  try {
    if (file.size > 65536) throw new Error();
    const input = fileSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()))
    );
    for (const field of ['tenantId', 'keyId', 'version', 'publicKey', 'fingerprint'] as const)
      if (input[field] !== expected[field]) throw new Error();
    if (
      (await organisationFingerprint(
        input.tenantId,
        input.keyId,
        input.version,
        input.publicKey
      )) !== input.fingerprint
    )
      throw new Error();
    const pkcs8 = bytes(input.privateKeyPkcs8);
    try {
      // ECDH's shared x coordinate alone cannot distinguish a public point from its negation.
      const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
      const proofKey = await crypto.subtle.importKey('pkcs8', pkcs8, algorithm, false, ['sign']);
      const verifier = await crypto.subtle.importKey(
        'raw',
        bytes(input.publicKey),
        algorithm,
        false,
        ['verify']
      );
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const signatureAlgorithm = { name: 'ECDSA', hash: 'SHA-256' };
      const signature = await crypto.subtle.sign(signatureAlgorithm, proofKey, challenge);
      if (!(await crypto.subtle.verify(signatureAlgorithm, verifier, signature, challenge)))
        throw new Error();
      return await crypto.subtle.importKey('pkcs8', pkcs8, ecdh, false, ['deriveBits']);
    } finally {
      pkcs8.fill(0);
    }
  } catch {
    throw new Error('INVALID_KEY');
  }
};
const symmetric = async (
  privateKey: CryptoKey,
  peer: Uint8Array<ArrayBuffer>,
  R: Uint8Array<ArrayBuffer>,
  pub: Uint8Array<ArrayBuffer>,
  tag: string
) => {
  const secret = await shared(privateKey, peer);
  try {
    const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: concat(R, pub), info: utf8.encode(tag) },
      ikm,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } finally {
    secret.fill(0);
  }
};
export const seal = async (
  t: Envelope['t'],
  pub: string,
  plain: Uint8Array<ArrayBuffer>,
  context: Field[]
): Promise<Envelope> => {
  const ephemeral = await pair(),
    R = await rawPublic(ephemeral.publicKey),
    P = bytes(pub);
  const key = await symmetric(ephemeral.privateKey, P, R, P, t),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc(t, ...context) },
    key,
    plain
  );
  return { v: 1, t, R: b64(R), nonce: b64(iv), ct: b64(new Uint8Array(ciphertext)) };
};
export const open = async (
  privateKey: CryptoKey,
  pub: string,
  e: Envelope,
  tag: Envelope['t'],
  context: Field[]
) => {
  if (e.t !== tag || e.v !== 1) throw new Error('INVALID_KEY');
  const R = bytes(e.R),
    key = await symmetric(privateKey, R, R, bytes(pub), tag);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(e.nonce), additionalData: enc(tag, ...context) },
      key,
      bytes(e.ct)
    )
  );
  if (plain.length !== 32) {
    plain.fill(0);
    throw new Error('INVALID_KEY');
  }
  return plain;
};
export const possessionProof = async (
  privateKey: CryptoKey,
  id: KeyIdentity,
  actor: string,
  prep: string,
  purpose: 'activation' | 'transfer',
  expiry: string,
  challenge: Envelope,
  transcript: Uint8Array<ArrayBuffer>
) => {
  const nonce = await open(privateKey, id.publicKey, challenge, 'SSF-ORG-POSSESSION-V1', [
    id.tenantId,
    actor,
    prep,
    purpose,
    id.keyId,
    id.version,
    expiry,
  ]);
  try {
    const hmac = await crypto.subtle.importKey(
      'raw',
      nonce,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return b64(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, transcript)));
  } finally {
    nonce.fill(0);
  }
};
export const activationProof = (
  key: CryptoKey,
  id: KeyIdentity,
  prep: Activation,
  actor: string,
  previous: string | null
) =>
  possessionProof(
    key,
    id,
    actor,
    prep.preparationId,
    'activation',
    prep.expiresAt,
    prep.challengeEnvelope,
    enc(
      'SSF-ORG-ACTIVATE-V1',
      id.tenantId,
      actor,
      prep.preparationId,
      id.keyId,
      id.version,
      bytes(id.publicKey),
      bytes(id.fingerprint),
      previous ?? '',
      prep.expiresAt,
      'saved'
    )
  );
