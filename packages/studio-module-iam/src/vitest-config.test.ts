import vitestConfig from '../vitest.config';

describe('studio-module-iam vitest coverage config', () => {
  it('inherits the shared coverage reporters required by the CI gate', () => {
    expect(vitestConfig.test?.coverage).toMatchObject({
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    });
  });
});
