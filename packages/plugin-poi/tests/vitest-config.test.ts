import vitestConfig from '../vitest.config';

describe('plugin-poi vitest coverage config', () => {
  it('inherits the shared coverage reporters required by the CI gate', () => {
    expect(vitestConfig.test?.coverage).toMatchObject({
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    });
  });

  it('registers the shared MSW setup file', () => {
    expect(vitestConfig.test?.setupFiles).toEqual(
      expect.arrayContaining([expect.stringMatching(/tooling\/testing\/src\/msw\/reset\.ts$/)])
    );
  });
});
