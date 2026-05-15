import vitestConfig from '../vitest.config';
import { sharedCoverageConfig } from '../../../vitest.config';

describe('plugin-poi vitest coverage config', () => {
  it('inherits the shared coverage reporters required by the CI gate', () => {
    expect(vitestConfig.test?.coverage).toMatchObject(sharedCoverageConfig);
  });
});
