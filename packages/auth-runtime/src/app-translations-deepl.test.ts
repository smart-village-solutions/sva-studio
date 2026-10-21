import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalInterfaceRecord } from '@sva/core';
const deps = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), reveal: vi.fn() }));
vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: deps.load,
  loadExternalInterfaceRecordById: deps.load,
  saveDeepLInterfaceCheck: deps.save,
}));
vi.mock('./iam-account-management/encryption.js', () => ({ revealField: deps.reveal }));
import {
  checkDeepLLanguages,
  getDeepLSetupStatus,
  parseDeepLLanguages,
} from './app-translations-deepl.js';
const record = (): ExternalInterfaceRecord => ({
  id: 'deepl-a',
  instanceId: 'tenant',
  typeKey: 'deepl',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'DeepL',
  alias: 'deepl',
  enabled: true,
  isDefault: true,
  category: 'api',
  statusCheckKind: 'deepl',
  visibleStatus: 'ok',
  lastCheckStatus: 'succeeded',
  secretConfigCiphertext: 'cipher',
  publicConfig: {
    revision: 'v1',
    credentialRevision: 'key1',
    verifiedCredentialRevision: 'key1',
    plan: 'pro',
    englishVariant: 'en-GB',
    selectedLocales: ['en'],
    availableLanguages: [{ code: 'en-GB', name: 'English', tagHandling: true }],
  },
});
const languages = [
  {
    lang: 'de',
    name: 'German',
    usable_as_source: true,
    usable_as_target: true,
    status: 'stable',
    features: { tag_handling: { status: 'stable' } },
  },
  {
    lang: 'en-GB',
    name: 'English',
    usable_as_source: false,
    usable_as_target: true,
    status: 'stable',
    features: { tag_handling: { status: 'stable' } },
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  deps.load.mockResolvedValue(record());
  deps.reveal.mockReturnValue(JSON.stringify({ apiKey: 'private-key' }));
});
describe('instance DeepL setup', () => {
  it('requires current verification, enabled interface, readable key and selected supported targets', () => {
    expect(getDeepLSetupStatus(record()).ready).toBe(true);
    const changed = {
      ...record(),
      publicConfig: { ...record().publicConfig, credentialRevision: 'key2' },
    };
    expect(getDeepLSetupStatus(changed).reason).toBe('check_required');
    expect(getDeepLSetupStatus({ ...record(), enabled: false }).reason).toBe('disabled');
    expect(
      getDeepLSetupStatus({
        ...record(),
        publicConfig: { ...record().publicConfig, selectedLocales: ['ro'] },
      }).reason
    ).toBe('languages_required');
    deps.reveal.mockReturnValue(undefined);
    expect(getDeepLSetupStatus(record()).reason).toBe('secret_missing');
    expect(getDeepLSetupStatus(null).reason).toBe('not_configured');
  });
  it('probes only a fixed official host without redirects or content and binds the result to exact saved revision', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(languages));
    expect(await checkDeepLLanguages('tenant', 'deepl-a', fetch)).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.deepl.com/v3/languages?resource=translate_text',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: { Authorization: 'DeepL-Auth-Key private-key', Accept: 'application/json' },
      })
    );
    expect(deps.save).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant',
        interfaceId: 'deepl-a',
        expectedRevision: 'v1',
        languages: expect.arrayContaining([{ code: 'en-GB', name: 'English', tagHandling: true }]),
      })
    );
    expect(JSON.stringify(await checkDeepLLanguages('tenant', 'deepl-a', fetch))).not.toContain(
      'private-key'
    );
  });
  it.each([
    [401, 'deepl_auth_failed'],
    [429, 'deepl_rate_limited'],
    [503, 'deepl_unavailable'],
  ])('records safe failure for HTTP %s', async (status, code) => {
    const fetch = vi.fn().mockResolvedValue(new Response('private provider details', { status }));
    expect(await checkDeepLLanguages('tenant', 'deepl-a', fetch)).toEqual({
      ok: false,
      errorCode: code,
    });
    expect(deps.save).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: code, languages: undefined })
    );
  });
  it('does not leak a network exception or accept malformed/oversized provider responses', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('private-key'));
    expect(await checkDeepLLanguages('tenant', 'deepl-a', fetch)).toEqual({
      ok: false,
      errorCode: 'deepl_unavailable',
    });
    fetch.mockResolvedValue(new Response(' '.repeat(262145)));
    expect(await checkDeepLLanguages('tenant', 'deepl-a', fetch)).toEqual({
      ok: false,
      errorCode: 'deepl_invalid_response',
    });
    expect(() => parseDeepLLanguages([])).toThrow('deepl_invalid_response');
    expect(() => parseDeepLLanguages([...languages, languages[1]])).toThrow(
      'deepl_invalid_response'
    );
  });
  it('propagates the revision conflict instead of accepting a late check after key rotation', async () => {
    deps.save.mockRejectedValue(new Error('interface_conflict'));
    await expect(
      checkDeepLLanguages('tenant', 'deepl-a', vi.fn().mockResolvedValue(Response.json(languages)))
    ).rejects.toThrow('interface_conflict');
  });
  it('rejects foreign or disabled interfaces before provider access', async () => {
    const fetch = vi.fn();
    deps.load.mockResolvedValue(null);
    await expect(checkDeepLLanguages('other', 'deepl-a', fetch)).rejects.toThrow(
      'interface_not_found'
    );
    deps.load.mockResolvedValue({ ...record(), enabled: false });
    await expect(checkDeepLLanguages('tenant', 'deepl-a', fetch)).rejects.toThrow('deepl_disabled');
    expect(fetch).not.toHaveBeenCalled();
  });
});
