import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from './a11y';

type AxeRun = (context?: axe.ElementContext, options?: axe.RunOptions) => Promise<axe.AxeResults>;

const { mockAxeRun } = vi.hoisted(() => ({
  mockAxeRun: vi.fn<AxeRun>(),
}));

vi.mock('axe-core', () => ({
  default: {
    run: mockAxeRun,
  },
}));

type AxeRunResult = Awaited<ReturnType<AxeRun>>;
type AxeViolation = AxeRunResult['violations'][number];
type AxeNodeResult = AxeViolation['nodes'][number];

const createAxeResults = (violations: AxeRunResult['violations']): AxeRunResult =>
  ({
    violations,
  }) as unknown as AxeRunResult;

const createNodeResult = (target: string[]): AxeNodeResult =>
  ({
    target,
  }) as unknown as AxeNodeResult;

const createViolation = (
  overrides: Pick<AxeViolation, 'id' | 'help' | 'nodes'> & Partial<Omit<AxeViolation, 'id' | 'help' | 'nodes'>>
): AxeViolation => ({
  description: '',
  helpUrl: '',
  impact: undefined,
  tags: [],
  ...overrides,
});

describe('expectNoA11yViolations', () => {
  it('passes through when axe reports no violations', async () => {
    mockAxeRun.mockResolvedValueOnce(createAxeResults([]));

    await expect(expectNoA11yViolations(document.createElement('div'))).resolves.toBeUndefined();
  });

  it('includes violation ids, help text, and flattened targets in the assertion message', async () => {
    mockAxeRun.mockResolvedValueOnce(
      createAxeResults([
        createViolation({
          id: 'image-alt',
          help: 'Images must have alternate text',
          nodes: [createNodeResult(['.hero-image']), createNodeResult(['#logo-link'])],
        }),
      ])
    );

    await expect(expectNoA11yViolations(document.createElement('div'))).rejects.toThrowError(
      /image-alt: Images must have alternate text \[\.hero-image, #logo-link\]/
    );
  });

  it('omits empty target brackets when axe does not report any selectors', async () => {
    mockAxeRun.mockResolvedValueOnce(
      createAxeResults([
        createViolation({
          id: 'button-name',
          help: 'Buttons must have discernible text',
          nodes: [createNodeResult([])],
        }),
      ])
    );

    const result = await expectNoA11yViolations(document.createElement('div')).catch((error: unknown) => error);
    const message = (result as Error).message;

    expect(result).toBeInstanceOf(Error);
    expect(message).toContain('button-name: Buttons must have discernible text');
    expect(message).not.toContain('button-name: Buttons must have discernible text [');
  });
});
