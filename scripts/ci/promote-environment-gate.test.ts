import { describe, expect, it } from 'vitest';

import { evaluateEnvironmentRunGate } from './promote-environment-gate.ts';

describe('promote environment gate', () => {
  it('names the rejected environment and the allowed values', () => {
    expect(evaluateEnvironmentRunGate({ environment: undefined, label: 'Migration' })).toMatchObject({
      message: 'Migration-Gate blockiert: Zielumgebung fehlend ist ungültig; erlaubt sind dev, staging oder prod.',
      ok: false,
    });
  });
});
