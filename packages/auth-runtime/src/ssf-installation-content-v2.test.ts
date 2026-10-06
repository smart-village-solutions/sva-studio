import { describe, expect, it, vi } from 'vitest';

import { dispatchSsfInstallationContentV2Request } from './ssf-installation-content-v2.js';

const url = 'https://studio.example/internal/plugins/ssf/v2/installation-content';
const authenticated = vi.fn().mockResolvedValue({ kind: 'authenticated', subject: 'ssf-service' });
const audit = vi.fn().mockResolvedValue(undefined);

describe('SSF V2 installation content access', () => {
  it('serves content with service identity and without a tenant header', async () => {
    const content = { contractVersion: '2.0', configurationRevision: `sha256:${'a'.repeat(64)}` };
    const readContent = vi.fn().mockResolvedValue(content);
    const response = await dispatchSsfInstallationContentV2Request(
      new Request(url, { headers: { Authorization: 'Bearer valid' } }),
      { authenticateToken: authenticated, readContent, emitSecurityAudit: audit }
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual(content);
    expect(readContent).toHaveBeenCalledTimes(1);
  });

  it('rejects missing service credentials before reading content', async () => {
    const readContent = vi.fn();
    const response = await dispatchSsfInstallationContentV2Request(
      new Request(url),
      { authenticateToken: authenticated, readContent, emitSecurityAudit: audit }
    );
    expect(response?.status).toBe(401);
    expect(readContent).not.toHaveBeenCalled();
  });

  it('returns no partial content when the installation is not configured', async () => {
    const response = await dispatchSsfInstallationContentV2Request(
      new Request(url, { headers: { Authorization: 'Bearer valid' } }),
      { authenticateToken: authenticated, readContent: async () => { throw new Error('missing content'); }, emitSecurityAudit: audit }
    );
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      contractVersion: '2.0', error: { code: 'runtime_configuration_unavailable' },
    });
  });
});
