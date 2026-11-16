import { describe, expect, it, vi } from 'vitest';

import type { SvaMainserverOwnershipTransferContent } from '../../types.js';
import { createSvaMainserverService } from '../service.js';

const contents = [
  { type: 'news', id: 'news-1' },
  { type: 'event', id: 'event-1' },
  { type: 'poi', id: 'poi-1' },
  { type: 'generic-item', id: 'generic-1' },
] as const satisfies readonly SvaMainserverOwnershipTransferContent[];

describe('Mainserver ownership transfer incident protection', () => {
  it.each(contents)(
    'refuses $type transfers before accessing config, credentials or upstream',
    async (content) => {
      const loadInstanceConfig = vi.fn();
      const readCredentials = vi.fn();
      const fetchImpl = vi.fn();
      const service = createSvaMainserverService({
        loadInstanceConfig,
        readCredentials,
        fetchImpl,
      });

      await expect(
        service.transferContentOwnership({
          instanceId: 'instance-1',
          keycloakSubject: 'actor-1',
          content,
          expectedSourceDataProviderId: 'source',
          targetDataProviderId: 'target',
        })
      ).rejects.toMatchObject({
        code: 'content_transfer_temporarily_disabled',
        statusCode: 409,
      });
      expect(loadInstanceConfig).not.toHaveBeenCalled();
      expect(readCredentials).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );
});
