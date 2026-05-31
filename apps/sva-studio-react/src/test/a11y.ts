import axe from 'axe-core';
import { expect } from 'vitest';

const componentAxeOptions = {
  rules: {
    // Komponenten werden isoliert gerendert, daher wären globale Landmark-Regeln hier nur Rauschen.
    region: { enabled: false },
    // happy-dom kann visuelle Kontrastberechnung nicht belastbar simulieren.
    'color-contrast': { enabled: false },
  },
} as const;

const runAxe = (container: HTMLElement) => axe.run<axe.AxeResults>(container, componentAxeOptions);

type AxeViolation = Awaited<ReturnType<typeof runAxe>>['violations'][number];
type AxeNodeResult = AxeViolation['nodes'][number];

const formatViolations = (violations: readonly AxeViolation[]) =>
  violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node: AxeNodeResult) => node.target)
        .map((target) => target.toString())
        .join(', ');

      return `${violation.id}: ${violation.help}${targets.length > 0 ? ` [${targets}]` : ''}`;
    })
    .join('\n');

export const expectNoA11yViolations = async (container: HTMLElement) => {
  const results = await runAxe(container);

  expect(results.violations, formatViolations(results.violations)).toEqual([]);
};
