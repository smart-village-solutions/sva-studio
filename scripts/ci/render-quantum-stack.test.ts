import { describe, expect, it } from 'vitest';

import { renderQuantumStack } from './render-quantum-stack.ts';

describe('render-quantum-stack', () => {
  it('removes the Compose project name and adds the Swarm version structurally', () => {
    const result = JSON.parse(
      renderQuantumStack(
        JSON.stringify({ name: 'studio', services: { app: { image: 'example/app:1' } } })
      )
    ) as Record<string, unknown>;

    expect(result).toEqual({
      version: '3.8',
      services: { app: { image: 'example/app:1' } },
    });
    expect(result).not.toHaveProperty('name');
  });
});
