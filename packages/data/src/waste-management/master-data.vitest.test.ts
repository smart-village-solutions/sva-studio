import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data waste master data compatibility', () => {
  it('re-exports the leading waste master data repository factory', () => {
    expect(data.createWasteMasterDataRepository).toBe(repos.createWasteMasterDataRepository);
  });

  it('re-exports the leading waste master data statements', () => {
    expect(data.wasteMasterDataStatements).toBe(repos.wasteMasterDataStatements);
  });
});
