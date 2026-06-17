import { describe, expect, it } from 'vitest';

import * as dataServer from '../server.js';
import * as local from './instance-integrations.server.js';
import * as reposServer from '@sva/data-repositories/server';

describe('@sva/data server instance integration compatibility', () => {
  it('re-exports the leading server loader from @sva/data/server', () => {
    expect(dataServer.loadInstanceIntegrationRecord).toBe(reposServer.loadInstanceIntegrationRecord);
  });

  it('re-exports the leading save and reset helpers from the local server compatibility module', () => {
    expect(local.saveInstanceIntegrationRecord).toBe(reposServer.saveInstanceIntegrationRecord);
    expect(local.resetInstanceIntegrationServerState).toBe(reposServer.resetInstanceIntegrationServerState);
  });
});
